import { useMemo, useRef, useState } from 'react';
import {
  Camera,
  CalendarDays,
  GraduationCap,
  Plus,
  Save,
  School,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react';
import { useTeacher } from '../../contexts/TeacherContext';
import { teacherProfileService } from '../../services/api';
import Students from './Students';
import Classes from './Classes';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';

type ProfileTab = 'overview' | 'students' | 'classes';
type SaveStatus = { type: 'idle' | 'uploading' | 'saving' | 'success' | 'error'; message: string };
type LocalSchool = { id: string; name: string };
type ScheduleItem = {
  id: string;
  day: number;
  startTime: string;
  endTime: string;
  schoolName: string;
  className: string;
  subject: string;
};

const days = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
const makeId = () => crypto.randomUUID();

export default function TeacherProfile({
  initialTab = 'overview',
  onNavigate,
}: {
  initialTab?: ProfileTab;
  onNavigate?: (tab: string) => void;
}) {
  const { teacher, updateTeacher } = useTeacher();
  const [tab, setTab] = useState<ProfileTab>(initialTab);
  const [name, setName] = useState(teacher?.name || '');
  const [subject, setSubject] = useState(teacher?.subject || '');
  const [bio, setBio] = useState(teacher?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(teacher?.avatarUrl || '');
  const [schools, setSchools] = useState<LocalSchool[]>(() =>
    teacher?.schools?.length
      ? teacher.schools.map((school) => ({ id: school.id || makeId(), name: school.name }))
      : teacher?.schoolName
        ? [{ id: makeId(), name: teacher.schoolName }]
        : [],
  );
  const [newSchool, setNewSchool] = useState('');
  const [schedule, setSchedule] = useState<ScheduleItem[]>(() =>
    (teacher?.schedule || []).map((item) => ({
      id: item.id || makeId(),
      day: item.day,
      startTime: item.startTime,
      endTime: item.endTime || '',
      schoolName: item.schoolName,
      className: item.className,
      subject: item.subject,
    })),
  );
  const [status, setStatus] = useState<SaveStatus>({ type: 'idle', message: '' });
  const fileRef = useRef<HTMLInputElement>(null);
  const profileSnapshot = JSON.stringify([name, subject, bio, avatarUrl, schools, schedule]);
  const [savedProfileSnapshot, setSavedProfileSnapshot] = useState(profileSnapshot);
  const guardProfileAction = useUnsavedChanges(profileSnapshot !== savedProfileSnapshot);
  const handleTabChange = (next: ProfileTab) =>
    guardProfileAction(() => {
      setTab(next);
      onNavigate?.(next === 'overview' ? 'profile' : next);
    });

  // Reinitialize only when a different authenticated account is loaded. Context updates
  // for avatar/profile fields must not erase the user's unsaved local draft.
  const [loadedTeacherId, setLoadedTeacherId] = useState(teacher?.id);
  if (teacher?.id !== loadedTeacherId) {
    setLoadedTeacherId(teacher?.id);
    setName(teacher?.name || '');
    setSubject(teacher?.subject || '');
    setBio(teacher?.bio || '');
    setAvatarUrl(teacher?.avatarUrl || '');
    setSchools(
      teacher?.schools?.length
        ? teacher.schools.map((school) => ({ id: school.id || makeId(), name: school.name }))
        : teacher?.schoolName
          ? [{ id: makeId(), name: teacher.schoolName }]
          : [],
    );
    setSchedule(
      (teacher?.schedule || []).map((item) => ({
        id: item.id || makeId(),
        day: item.day,
        startTime: item.startTime,
        endTime: item.endTime || '',
        schoolName: item.schoolName,
        className: item.className,
        subject: item.subject,
      })),
    );
  }

  const validationError = useMemo(() => {
    if (!name.trim()) return 'نام و نام خانوادگی را وارد کنید.';
    const invalidTime = schedule.find(
      (item) => item.endTime && item.startTime && item.endTime <= item.startTime,
    );
    if (invalidTime)
      return `ساعت پایان کلاس ${invalidTime.className || 'بدون نام'} باید بعد از شروع باشد.`;
    return '';
  }, [name, schedule]);

  const updateSchedule = (id: string, updates: Partial<ScheduleItem>) => {
    setSchedule((current) =>
      current.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  };

  const save = async () => {
    if (validationError) {
      setStatus({ type: 'error', message: validationError });
      return;
    }
    setStatus({ type: 'saving', message: 'در حال ذخیره اطلاعات…' });
    try {
      const updated = await teacherProfileService.save({
        name: name.trim(),
        subject: subject.trim(),
        bio: bio.trim(),
        avatarUrl,
        schools: schools.map((school, index) => ({
          id: school.id,
          name: school.name,
          isPrimary: index === 0,
        })),
        schedule: schedule.map((item) => ({
          id: item.id,
          day: item.day,
          startTime: item.startTime,
          endTime: item.endTime || undefined,
          schoolName: item.schoolName,
          className: item.className.trim(),
          subject: item.subject.trim(),
        })),
      });
      updateTeacher(updated);
      setAvatarUrl(updated.avatarUrl || avatarUrl);
      setSavedProfileSnapshot(profileSnapshot);
      setStatus({ type: 'success', message: 'تغییرات با موفقیت ذخیره شد.' });
    } catch (error) {
      setStatus({
        type: 'error',
        message:
          error instanceof Error ? error.message : 'ذخیره اطلاعات انجام نشد. دوباره تلاش کنید.',
      });
    }
  };

  const uploadAvatar = async (file?: File) => {
    if (!file) return;
    setStatus({ type: 'uploading', message: 'در حال بارگذاری تصویر…' });
    try {
      const uploadedUrl = await teacherProfileService.uploadAvatar(file);
      setAvatarUrl(uploadedUrl);
      setStatus({
        type: 'success',
        message: 'تصویر آماده است. برای ثبت نهایی، تغییرات را ذخیره کنید.',
      });
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'بارگذاری تصویر انجام نشد.',
      });
    }
  };

  const addSchool = () => {
    const value = newSchool.trim();
    if (!value) return;
    if (
      schools.some(
        (school) => school.name.localeCompare(value, 'fa', { sensitivity: 'base' }) === 0,
      )
    ) {
      setStatus({ type: 'error', message: 'این مدرسه قبلاً اضافه شده است.' });
      return;
    }
    setSchools((current) => [...current, { id: makeId(), name: value }]);
    setNewSchool('');
  };

  const removeSchool = (school: LocalSchool) => {
    setSchools((current) => current.filter((item) => item.id !== school.id));
    setSchedule((current) =>
      current.map((item) => (item.schoolName === school.name ? { ...item, schoolName: '' } : item)),
    );
  };

  const addSchedule = () => {
    setSchedule((current) => [
      ...current,
      {
        id: makeId(),
        day: 0,
        startTime: '08:00',
        endTime: '09:00',
        schoolName: schools[0]?.name || '',
        className: '',
        subject,
      },
    ]);
  };

  if (tab === 'students') {
    return (
      <div>
        <ProfileHeader tab={tab} setTab={handleTabChange} />
        <Students />
      </div>
    );
  }
  if (tab === 'classes') {
    return (
      <div>
        <ProfileHeader tab={tab} setTab={handleTabChange} />
        <Classes />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <ProfileHeader tab={tab} setTab={handleTabChange} />

      <section className="profile-cover glx overflow-hidden rounded-[28px] p-5 sm:p-7">
        <div className="relative z-10 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative shrink-0"
            aria-label="تغییر تصویر پروفایل"
            disabled={status.type === 'uploading'}
          >
            {avatarUrl ? (
              <img
                loading="eager"
                decoding="async"
                src={avatarUrl}
                alt={`تصویر پروفایل ${name || 'دبیر'}`}
                className="h-24 w-24 rounded-3xl object-cover ring-4 ring-white/50"
              />
            ) : (
              <span className="grid h-24 w-24 place-items-center rounded-3xl bg-[var(--color-ink)] text-heading-1 font-black text-[var(--color-text-on-solid)]">
                {name[0] || 'م'}
              </span>
            )}
            <span className="absolute -bottom-2 -left-2 grid h-9 w-9 place-items-center rounded-xl bg-[var(--color-gold)] text-[var(--color-ink)] shadow-md">
              <Camera className="h-4 w-4" aria-hidden="true" />
            </span>
          </button>
          <input
            ref={fileRef}
            hidden
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => uploadAvatar(event.target.files?.[0])}
          />

          <div className="flex-1">
            <p className="mb-1 text-caption font-bold text-[var(--color-text-secondary)]">
              پروفایل حرفه‌ای دبیر
            </p>
            <h1 className="text-heading-1 font-black">{name || 'پروفایل دبیر'}</h1>
            <p className="mt-2 text-label text-[var(--color-text-secondary)]">
              {subject || 'درس تخصصی ثبت نشده'} ·{' '}
              {schools.length ? `${schools.length} مدرسه` : 'مدرسه‌ای ثبت نشده'}
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <button
              type="button"
              onClick={save}
              disabled={status.type === 'saving' || status.type === 'uploading'}
              className="btn-brand disabled:cursor-wait disabled:opacity-60"
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              {status.type === 'saving' ? 'در حال ذخیره…' : 'ذخیره تغییرات'}
            </button>
            {status.message && (
              <p
                role={status.type === 'error' ? 'alert' : 'status'}
                aria-live="polite"
                className={`max-w-xs text-caption ${status.type === 'error' ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-secondary)]'}`}
              >
                {status.message}
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
        <section className="glx panel-shell space-y-5">
          <SectionTitle
            icon={<UserRound />}
            title="اطلاعات دبیر"
            description="اطلاعاتی که در پنل و آزمون‌ها نمایش داده می‌شود."
          />
          <label className="field-label">
            نام و نام خانوادگی
            <input
              className="profile-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="field-label">
            درس یا دروس تخصصی
            <input
              className="profile-input"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="مثلاً ریاضی و فیزیک"
            />
          </label>
          <label className="field-label">
            درباره من
            <textarea
              className="profile-input min-h-24 resize-y py-3 leading-7"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              placeholder="معرفی کوتاه برای نمایش در کنار آزمون‌ها"
              maxLength={1000}
            />
            <span className="mt-1 block text-caption font-normal text-[var(--color-text-tertiary)]">
              {bio.length.toLocaleString('fa-IR')} از ۱٬۰۰۰ نویسه
            </span>
          </label>

          <div>
            <p className="field-label mb-2">مدارس محل تدریس</p>
            <div className="space-y-2">
              {schools.map((school, index) => (
                <div key={school.id} className="flex items-center gap-2">
                  <div className="profile-input mt-0 flex flex-1 items-center gap-2">
                    <School className="h-4 w-4 text-[var(--color-ink)]" aria-hidden="true" />
                    <span className="flex-1">{school.name}</span>
                    {index === 0 && (
                      <span className="text-caption text-[var(--color-text-tertiary)]">اصلی</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSchool(school)}
                    className="min-h-11 rounded-xl px-3 text-caption text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]"
                  >
                    حذف
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                className="profile-input mt-0 flex-1"
                value={newSchool}
                onChange={(event) => setNewSchool(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addSchool();
                  }
                }}
                placeholder="نام مدرسه جدید"
                aria-label="نام مدرسه جدید"
              />
              <button type="button" className="btn-soft" onClick={addSchool}>
                <Plus className="h-4 w-4" aria-hidden="true" /> افزودن
              </button>
            </div>
          </div>
        </section>

        <section className="glx panel-shell">
          <SectionTitle
            icon={<CalendarDays />}
            title="برنامه هفتگی"
            description="کلاس‌ها، مدرسه و ساعت تدریس شما."
          />
          <div className="mt-5 grid grid-cols-7 gap-1" aria-label="روزهای هفته">
            {days.map((day) => (
              <div
                key={day}
                title={day}
                className="glx-inset rounded-xl py-2 text-center text-caption"
              >
                {day.slice(0, 2)}
              </div>
            ))}
          </div>

          <div className="mt-5 space-y-3">
            {schedule.length ? (
              schedule.map((item) => (
                <div key={item.id} className="schedule-card">
                  <label>
                    <span>روز</span>
                    <select
                      value={item.day}
                      onChange={(event) =>
                        updateSchedule(item.id, { day: Number(event.target.value) })
                      }
                    >
                      {days.map((day, index) => (
                        <option key={day} value={index}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>شروع</span>
                    <input
                      type="time"
                      value={item.startTime}
                      onChange={(event) =>
                        updateSchedule(item.id, { startTime: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    <span>پایان</span>
                    <input
                      type="time"
                      value={item.endTime}
                      onChange={(event) => updateSchedule(item.id, { endTime: event.target.value })}
                    />
                  </label>
                  <label>
                    <span>مدرسه</span>
                    <select
                      value={item.schoolName}
                      onChange={(event) =>
                        updateSchedule(item.id, { schoolName: event.target.value })
                      }
                    >
                      <option value="">انتخاب مدرسه</option>
                      {schools.map((school) => (
                        <option key={school.id} value={school.name}>
                          {school.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>کلاس</span>
                    <input
                      value={item.className}
                      onChange={(event) =>
                        updateSchedule(item.id, { className: event.target.value })
                      }
                      placeholder="مثلاً هفتم الف"
                    />
                  </label>
                  <label>
                    <span>درس</span>
                    <input
                      value={item.subject}
                      onChange={(event) => updateSchedule(item.id, { subject: event.target.value })}
                      placeholder="نام درس"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setSchedule((current) => current.filter((row) => row.id !== item.id))
                    }
                    className="schedule-delete"
                    aria-label="حذف این کلاس از برنامه"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ))
            ) : (
              <div className="empty-quiet">
                <CalendarDays className="h-7 w-7" aria-hidden="true" />
                <p>برنامه‌ای ثبت نشده است.</p>
              </div>
            )}
          </div>
          <button
            type="button"
            className="btn-soft mt-4 w-full justify-center"
            onClick={addSchedule}
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> افزودن کلاس به برنامه
          </button>
        </section>
      </div>
    </div>
  );
}

function SectionTitle({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="section-title">
      {icon}
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
}

function ProfileHeader({ tab, setTab }: { tab: ProfileTab; setTab: (tab: ProfileTab) => void }) {
  const tabs: Array<{ id: ProfileTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'پروفایل', icon: <UserRound /> },
    { id: 'students', label: 'دانش‌آموزان', icon: <Users /> },
    { id: 'classes', label: 'کلاس‌ها', icon: <GraduationCap /> },
  ];
  const activate = (next: ProfileTab) => {
    setTab(next);
  };
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-heading-2 font-black">مرکز دبیر و کلاس‌ها</h1>
        <p className="mt-1 text-caption text-[var(--color-text-tertiary)]">
          پروفایل، دانش‌آموزان و برنامه تدریس در یک مکان
        </p>
      </div>
      <div
        className="segmented-control"
        role="tablist"
        aria-label="بخش‌های پروفایل دبیر"
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault();
          const index = tabs.findIndex((item) => item.id === tab);
          const direction = event.key === 'ArrowLeft' ? 1 : -1;
          const next = tabs[(index + direction + tabs.length) % tabs.length];
          activate(next.id);
          requestAnimationFrame(() =>
            event.currentTarget.querySelector<HTMLElement>('[aria-selected="true"]')?.focus(),
          );
        }}
      >
        {tabs.map((item) => (
          <button
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            tabIndex={tab === item.id ? 0 : -1}
            key={item.id}
            onClick={() => activate(item.id)}
            className={tab === item.id ? 'active' : ''}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
