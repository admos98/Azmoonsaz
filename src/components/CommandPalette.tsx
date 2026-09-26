import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  GraduationCap,
  Home,
  Keyboard,
  PlusCircle,
  Search,
  Settings,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { normalizePersianText } from '../utils/persian';
import { usePersistentPreference } from '../hooks/usePersistentPreference';
import { preloadTeacherPage } from '../utils/teacherPageLoaders';
import { classService, examService, studentService } from '../services/api';

type Command = {
  id: string;
  label: string;
  description: string;
  keywords: string;
  icon: typeof Home;
  destination?: string;
};

const commands: Command[] = [
  {
    id: 'dashboard',
    label: 'داشبورد',
    description: 'نمای کلی فعالیت‌ها',
    keywords: 'خانه آمار',
    icon: Home,
  },
  {
    id: 'exams',
    label: 'آزمون‌ها',
    description: 'مدیریت و مشاهده آزمون‌ها',
    keywords: 'امتحان فهرست',
    icon: BookOpen,
  },
  {
    id: 'new-exam',
    label: 'ساخت آزمون',
    description: 'ایجاد آزمون تازه',
    keywords: 'جدید افزودن امتحان',
    icon: PlusCircle,
  },
  {
    id: 'profile',
    label: 'پروفایل دبیر',
    description: 'اطلاعات و برنامه تدریس',
    keywords: 'حساب مشخصات',
    icon: UserRound,
  },
  {
    id: 'students',
    label: 'دانش‌آموزان',
    description: 'فهرست و ورود اطلاعات',
    keywords: 'هنرجو شاگرد',
    icon: Users,
  },
  {
    id: 'classes',
    label: 'کلاس‌ها',
    description: 'مدیریت گروه‌های کلاسی',
    keywords: 'پایه گروه',
    icon: GraduationCap,
  },
  {
    id: 'settings',
    label: 'تنظیمات',
    description: 'ظاهر، حرکت و فضای کاری',
    keywords: 'ترجیحات پوسته',
    icon: Settings,
  },
];

export default function CommandPalette({
  onNavigate,
}: {
  onNavigate: (destination: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [entityCommands, setEntityCommands] = useState<Command[]>([]);
  const [entitiesLoading, setEntitiesLoading] = useState(false);
  const [recentCommandIds, setRecentCommandIds] = usePersistentPreference<string[]>(
    'commands:recent',
    [],
    (value): value is string[] =>
      Array.isArray(value) && value.every((item) => typeof item === 'string'),
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const shortcutPrefixRef = useRef(false);
  const shortcutTimerRef = useRef<number | null>(null);

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
        setOpen((current) => {
          if (!current) {
            setQuery('');
            setActiveIndex(0);
            if (!entityCommands.length) setEntitiesLoading(true);
          }
          return !current;
        });
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleShortcut);
    return () => {
      window.removeEventListener('keydown', handleShortcut);
      if (shortcutTimerRef.current) window.clearTimeout(shortcutTimerRef.current);
    };
  }, [entityCommands.length, onNavigate]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
    else triggerRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open || entityCommands.length) return;
    let active = true;
    Promise.all([
      examService.getExams(),
      studentService.getStudents(),
      classService.getClassGroups(),
    ])
      .then(([exams, students, classes]) => {
        if (!active) return;
        setEntityCommands([
          ...exams.map((exam) => ({
            id: `exam:${exam.id}`,
            destination: 'exams',
            label: exam.title,
            description: 'آزمون',
            keywords: `آزمون امتحان ${exam.status}`,
            icon: BookOpen,
          })),
          ...students.map((student) => ({
            id: `student:${student.id}`,
            destination: 'students',
            label: student.name,
            description: `دانش‌آموز پایه ${student.grade}`,
            keywords: `دانش آموز ${student.nationalId}`,
            icon: Users,
          })),
          ...classes.map((classGroup) => ({
            id: `class:${classGroup.id}`,
            destination: 'classes',
            label: classGroup.name,
            description: `کلاس پایه ${classGroup.grade}`,
            keywords: 'کلاس گروه پایه',
            icon: GraduationCap,
          })),
        ]);
      })
      .catch(() => {
        // Destination commands remain available when live entity search is unavailable.
      })
      .finally(() => {
        if (active) setEntitiesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [entityCommands.length, open]);

  const run = (command: Command) => {
    setRecentCommandIds((current) =>
      [command.id, ...current.filter((id) => id !== command.id)].slice(0, 4),
    );
    setOpen(false);
    onNavigate(command.destination || command.id);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setQuery('');
          setActiveIndex(0);
          if (!entityCommands.length) setEntitiesLoading(true);
          setOpen(true);
        }}
        className="command-palette-trigger fixed bottom-4 left-4 z-40 flex min-h-11 items-center gap-2 rounded-xl border border-[var(--color-glass-light-stroke)] bg-[var(--color-surface-primary)]/90 px-3 text-caption font-bold text-[var(--color-text-secondary)] shadow-lg backdrop-blur-xl hover:text-[var(--color-text-primary)]"
        aria-label="باز کردن جستجو و فرمان‌ها"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">جستجو</span>
        <kbd
          dir="ltr"
          className="rounded-md bg-[var(--color-surface-secondary)] px-1.5 py-0.5 text-micro"
        >
          Ctrl K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-[var(--color-overlay)] p-4 pt-[12vh] backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="جستجو و فرمان‌ها"
            className="relative glx-strong glass-edge w-full max-w-xl overflow-hidden rounded-3xl border border-[var(--color-glass-light-stroke)] shadow-2xl"
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
                className="h-14 flex-1 bg-transparent text-label text-[var(--color-text-primary)] outline-none"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2"
                aria-label="بستن"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[55vh] overflow-y-auto p-2" role="listbox">
              {filtered.length ? (
                filtered.map((command, index) => {
                  const Icon = command.icon;
                  return (
                    <button
                      type="button"
                      role="option"
                      aria-selected={index === activeIndex}
                      key={command.id}
                      onMouseEnter={() => {
                        setActiveIndex(index);
                        preloadTeacherPage(command.id);
                      }}
                      onFocus={() => preloadTeacherPage(command.id)}
                      onClick={() => run(command)}
                      className={`flex w-full items-center gap-3 rounded-2xl p-3 text-right ${index === activeIndex ? 'bg-[var(--color-accent-soft)] text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'}`}
                    >
                      <span className="rounded-xl bg-[var(--color-surface-secondary)] p-2">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span>
                        <strong className="block text-label">{command.label}</strong>
                        <span className="text-caption text-[var(--color-text-tertiary)]">
                          {command.description}
                        </span>
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="px-4 py-10 text-center">
                  <p className="font-bold text-[var(--color-text-primary)]">نتیجه‌ای پیدا نشد</p>
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="mt-2 text-caption font-bold text-[var(--color-accent)]"
                  >
                    پاک کردن جستجو
                  </button>
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
