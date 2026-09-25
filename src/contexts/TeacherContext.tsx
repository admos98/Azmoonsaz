/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Teacher } from '../types';
import { authService } from '../services/api';

interface TeacherContextValue {
  teacher: Teacher | null;
  loading: boolean;
  refresh: () => Promise<void>;
  updateTeacher: (updates: Partial<Teacher>) => void;
}

const TeacherContext = createContext<TeacherContextValue>({
  teacher: null,
  loading: true,
  refresh: async () => {},
  updateTeacher: () => {},
});

export function TeacherProvider({ children }: { children: ReactNode }) {
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTeacher = async () => {
    setLoading(true);
    try {
      const t = await authService.getCurrentTeacher();
      setTeacher(t);
    } catch {
      setTeacher(null);
    } finally {
      setLoading(false);
    }
  };

  const updateTeacher = (updates: Partial<Teacher>) => {
    setTeacher((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      localStorage.setItem('azmoonsaz_current_teacher', JSON.stringify(updated));
      return updated;
    });
  };

  useEffect(() => {
    let active = true;
    authService
      .getCurrentTeacher()
      .then((profile) => {
        if (active) setTeacher(profile);
      })
      .catch(() => {
        if (active) setTeacher(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <TeacherContext.Provider value={{ teacher, loading, refresh: fetchTeacher, updateTeacher }}>
      {children}
    </TeacherContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTeacher = () => useContext(TeacherContext);
