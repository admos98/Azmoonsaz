import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Home,
  Keyboard,
  PlusCircle,
  Search,
  Settings,
  UserRound,
  X,
} from 'lucide-react';
import { Cut } from './Cut';
import { normalizePersianText } from '../utils/persian';
import { TextLink } from './UIComponents';
import { usePersistentPreference } from '../hooks/usePersistentPreference';
import { preloadTeacherPage } from '../utils/teacherPageLoaders';
import { useTeacherCollections } from '../contexts/TeacherContext';

type Command = {
  id: string;
  label: string;
  description: string;
  keywords: string;
  icon: ReactNode;
  destination?: string;
};

const commands: Command[] = [
  {
    id: 'dashboard',
    label: 'داشبورد',
    description: 'نمای کلی فعالیت‌ها',
    keywords: 'خانه آمار',
    icon: <Home className="h-4 w-4" />,
  },
  {
    id: 'exams',
    label: 'آزمون‌ها',
    description: 'مدیریت و مشاهده آزمون‌ها',
    keywords: 'امتحان فهرست',
    icon: <Cut kind="exams" size={20} />,
  },
  {
    id: 'new-exam',
    label: 'ساخت آزمون',
    description: 'ایجاد آزمون تازه',
    keywords: 'جدید افزودن امتحان',
    icon: <PlusCircle className="h-4 w-4" />,
  },
  {
    id: 'profile',
    label: 'پروفایل دبیر',
    description: 'اطلاعات و برنامه تدریس',
    keywords: 'حساب مشخصات',
    icon: <UserRound className="h-4 w-4" />,
  },
  {
    id: 'students',
    label: 'دانش‌آموزان',
    description: 'فهرست و ورود اطلاعات',
    keywords: 'هنرجو شاگرد',
    icon: <Cut kind="students" size={20} />,
  },
  {
    id: 'classes',
    label: 'کلاس‌ها',
    description: 'مدیریت گروه‌های کلاسی',
    keywords: 'پایه گروه',
    icon: <Cut kind="classes" size={20} />,
  },
  {
    id: 'settings',
    label: 'تنظیمات',
    description: 'ظاهر، حرکت و فضای کاری',
    keywords: 'ترجیحات پوسته',
    icon: <Settings className="h-4 w-4" />,
  },
];

/**
 * Controlled by the Topbar: `open`/`setOpen`/`initialQuery` live up-tree so
 * the topbar search icon is the trigger (the old bottom-left floating button
 * was hidden on phones and orphaned on desktop). Query itself is local state —
 * the parent only seeds it on open.
 */
export default function CommandPalette({
  onNavigate,
  open,
  setOpen,
  initialQuery,
}: {
  onNavigate: (destination: string) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
  initialQuery: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [activeIndex, setActiveIndex] = useState(0);
  const { exams, students, classGroups, status } = useTeacherCollections();
  const [recentCommandIds, setRecentCommandIds] = usePersistentPreference<string[]>(
    'commands:recent',
    [],
    (value): value is string[] =>
      Array.isArray(value) && value.every((item) => typeof item === 'string'),
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const shortcutPrefixRef = useRef(false);
  const shortcutTimerRef = useRef<number | null>(null);

  // Live entities ride the shared collections cache — the palette used to
  // fire its own 3-request fetch the first time it opened.
  const entityCommands = useMemo<Command[]>(
    () => [
      ...exams.map((exam) => ({
        id: `exam:${exam.id}`,
        destination: 'exams',
        label: exam.title,
        description: 'آزمون',
        keywords: `آزمون امتحان ${exam.status}`,
        icon: <Cut kind="exams" size={20} />,
      })),
      ...students.map((student) => ({
        id: `student:${student.id}`,
        destination: 'students',
        label: student.name,
        description: `دانش‌آموز پایه ${student.grade}`,
        keywords: `دانش آموز ${student.nationalId}`,
        icon: <Cut kind="students" size={20} />,
      })),
      ...classGroups.map((classGroup) => ({
        id: `class:${classGroup.id}`,
        destination: 'classes',
        label: classGroup.name,
        description: `کلاس پایه ${classGroup.grade}`,
        keywords: 'کلاس گروه پایه',
        icon: <Cut kind="classes" size={20} />,
      })),
    ],
    [exams, students, classGroups],
  );
  const entitiesLoading =
    status.exams === 'loading' || status.students === 'loading' || status.classGroups === 'loading';

  const availableCommands = useMemo(() => [...commands, ...entityCommands], [entityCommands]);
  const filtered = useMemo(() => {
    const normalized = normalizePersianText(query);
    if (!normalized) {
      const recent = recentCommandIds
        .map((id) => availableCommands.find((command) => command.id === id))
        .filter((command): command is Command => Boolean(command));
      return [
        ...recent,
        ...availableCommands.filter((command) => !recentCommandIds.includes(command.id)),
      ];
    }
    return availableCommands.filter((command) =>
      normalizePersianText(`${command.label} ${command.description} ${command.keywords}`).includes(
        normalized,
      ),
    );
  }, [availableCommands, query, recentCommandIds]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target;
      const editing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);
      const key = event.key.toLowerCase();

      if (!editing && !event.metaKey && !event.ctrlKey && !event.altKey && key === 'g') {
        shortcutPrefixRef.current = true;
        if (shortcutTimerRef.current) window.clearTimeout(shortcutTimerRef.current);
        shortcutTimerRef.current = window.setTimeout(() => {
          shortcutPrefixRef.current = false;
        }, 1200);
        return;
      }
      if (!editing && shortcutPrefixRef.current) {
        const destinations: Record<string, string> = {
          d: 'dashboard',
          e: 'exams',
          n: 'new-exam',
          s: 'students',
          c: 'classes',
        };
        const destination = destinations[key];
        shortcutPrefixRef.current = false;
        if (destination) {
          event.preventDefault();
          onNavigate(destination);
          return;
        }
      }
      if ((event.metaKey || event.ctrlKey) && key === 'k') {
        event.preventDefault();
        setOpen(!open);
        setQuery('');
        setActiveIndex(0);
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleShortcut);
    return () => {
      window.removeEventListener('keydown', handleShortcut);
      if (shortcutTimerRef.current) window.clearTimeout(shortcutTimerRef.current);
    };
  }, [onNavigate, open, setOpen]);

  // Reset query/index when the panel opens — derived from the open transition,
  // done during render (not in an effect) per React docs.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setQuery(initialQuery);
      setActiveIndex(0);
    }
  }

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const run = (command: Command) => {
    setRecentCommandIds((current) =>
      [command.id, ...current.filter((id) => id !== command.id)].slice(0, 4),
    );
    setOpen(false);
    onNavigate(command.destination || command.id);
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center scrim veil-blur p-4 pt-[12vh]"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="جستجو و فرمان‌ها"
            className="relative lens w-full max-w-xl overflow-hidden rounded-3xl"
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveIndex((index) => (index + 1) % Math.max(filtered.length, 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveIndex(
                  (index) =>
                    (index - 1 + Math.max(filtered.length, 1)) % Math.max(filtered.length, 1),
                );
              } else if (event.key === 'Enter' && filtered[activeIndex]) {
                event.preventDefault();
                run(filtered[activeIndex]);
              }
            }}
          >
            <div className="flex items-center gap-3 border-b border-[var(--color-glass-light-stroke)] px-4">
              <Search className="h-5 w-5 text-[var(--color-text-tertiary)]" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                placeholder="آزمون، دانش‌آموز، کلاس یا تنظیمات…"
                aria-label="جستجوی فرمان‌ها"
                className="no-focus-ring h-14 flex-1 bg-transparent text-label text-[var(--color-text-primary)]"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn-glass btn-glass--danger modal-close grid h-9 w-9 shrink-0 place-items-center rounded-full cursor-pointer"
                aria-label="بستن"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[55vh] overflow-y-auto p-2" role="listbox">
              {filtered.length ? (
                filtered.map((command, index) => {
                  const isActive = index === activeIndex;
                  return (
                    <button
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      key={command.id}
                      onMouseEnter={() => {
                        setActiveIndex(index);
                        preloadTeacherPage(command.id);
                      }}
                      onFocus={() => preloadTeacherPage(command.id)}
                      onClick={() => run(command)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right transition-colors ${isActive ? 'btn-glass btn-glass--accent' : 'btn-glass btn-glass--bare'}`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${isActive ? 'border-[var(--color-glass-light-stroke)] bg-[var(--color-surface)]/60 text-[var(--color-accent)]' : 'border-transparent text-[var(--color-text-tertiary)]'}`}
                      >
                        {command.icon}
                      </span>
                      <span className="min-w-0">
                        <strong className="block text-label">{command.label}</strong>
                        <span className="block truncate text-caption text-[var(--color-text-tertiary)]">
                          {command.description}
                        </span>
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="px-4 py-10 text-center">
                  <p className="font-bold text-[var(--color-text-primary)]">نتیجه‌ای پیدا نشد</p>
                  <TextLink
                    size="md"
                    bold
                    hover="none"
                    onClick={() => setQuery('')}
                    className="mt-2"
                  >
                    پاک کردن جستجو
                  </TextLink>
                </div>
              )}
            </div>
            <footer className="flex items-center gap-2 border-t border-[var(--color-glass-light-stroke)] px-4 py-2 text-micro text-[var(--color-text-tertiary)]">
              <Keyboard className="h-3.5 w-3.5" />
              {entitiesLoading
                ? 'در حال دریافت آزمون‌ها، دانش‌آموزان و کلاس‌ها…'
                : 'جهت‌ها: انتخاب · Enter: اجرا · Esc: بستن · G سپس D/E/N/S/C: رفتن به بخش‌ها'}
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
