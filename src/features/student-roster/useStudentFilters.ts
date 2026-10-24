/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Students page list/filter state — moved verbatim from
 * src/pages/teacher/Students.tsx: the persisted search/sort/page-size/
 * grade/class/status preferences, the currentPage pager state and the two
 * URL query-string sync effects that surround them.
 */
import { useEffect, useRef, useState } from 'react';
import { usePersistentPreference } from '../../hooks/usePersistentPreference';

export function useStudentFilters() {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = usePersistentPreference<'name' | 'grade'>(
    'students:sort',
    'name',
    (value): value is 'name' | 'grade' => value === 'name' || value === 'grade',
  );
  const [pageSize, setPageSize] = usePersistentPreference<number>(
    'students:page-size',
    20,
    (value): value is number => value === 10 || value === 20 || value === 50,
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedGrade, setSelectedGrade, resetSelectedGrade] = usePersistentPreference(
    'students:grade',
    'all',
  );
  const [selectedClassGroup, setSelectedClassGroup, resetSelectedClassGroup] =
    usePersistentPreference('students:class', 'all');
  const [selectedStatus, setSelectedStatus, resetSelectedStatus] = usePersistentPreference(
    'students:status',
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
    setIfPresent('class', setSelectedClassGroup);
    setIfPresent('status', setSelectedStatus);
    const urlSort = params.get('sort');
    if (urlSort === 'name' || urlSort === 'grade') setSortOrder(urlSort);
    const urlPageSize = Number(params.get('pageSize'));
    if (urlPageSize === 10 || urlPageSize === 20 || urlPageSize === 50) setPageSize(urlPageSize);
    urlFiltersReady.current = true;
  }, [setPageSize, setSelectedClassGroup, setSelectedGrade, setSelectedStatus, setSortOrder]);

  useEffect(() => {
    if (!urlFiltersReady.current) return;
    const params = new URLSearchParams(window.location.search);
    const values: Record<string, string> = {
      q: searchQuery,
      grade: selectedGrade,
      class: selectedClassGroup,
      status: selectedStatus,
      sort: sortOrder,
      pageSize: String(pageSize),
    };
    Object.entries(values).forEach(([key, value]) => {
      if (
        !value ||
        value === 'all' ||
        (key === 'sort' && value === 'name') ||
        (key === 'pageSize' && value === '20')
      )
        params.delete(key);
      else params.set(key, value);
    });
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }, [pageSize, searchQuery, selectedClassGroup, selectedGrade, selectedStatus, sortOrder]);
  return {
    searchQuery,
    setSearchQuery,
    sortOrder,
    setSortOrder,
    pageSize,
    setPageSize,
    currentPage,
    setCurrentPage,
    selectedGrade,
    setSelectedGrade,
    resetSelectedGrade,
    selectedClassGroup,
    setSelectedClassGroup,
    resetSelectedClassGroup,
    selectedStatus,
    setSelectedStatus,
    resetSelectedStatus,
  };
}
