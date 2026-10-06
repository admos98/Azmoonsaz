import { useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  PageHeader,
  Tabs,
  Textarea,
} from '../../components/UIComponents';
import {
  Camera,
  CalendarDays,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  Plus,
  Save,
  School,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react';
import { useTeacher } from '../../contexts/TeacherContext';
import { teacherProfileService } from '../../services/api';
import { getSupabasePublicClient } from '../../lib/supabasePublic';
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

/* Shared field styling for the weekly schedule rows — native date/time and
   select pickers stay native (no library equivalent), styled to the system. */
const scheduleFieldClass =
  'w-full min-w-0 h-11 px-2 border border-[var(--color-glass-light-stroke)] rounded-xl bg-[var(--color-surface)] text-caption text-[var(--color-text-primary)]';
const scheduleLabelClass =
  'block mx-0.5 mb-1.5 text-micro font-bold text-[var(--color-text-tertiary)]';

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
  // Account security — password change (session-based updateUser, same auth
  // backend as ResetPassword; no old-password round trip exists client-side).
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{
    type: 'error' | 'success';
    text: string;
  } | null>(null);
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

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!newPassword || !confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'رمز عبور جدید و تکرار آن را وارد کنید.' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'رمز عبور باید حداقل ۶ کاراکتر باشد.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'رمز عبور و تکرار آن یکسان نیستند.' });
      return;
    }
    setPasswordBusy(true);
    setPasswordMessage(null);
    try {
      const supabase = getSupabasePublicClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage({
        type: 'success',
        text: 'رمز عبور با موفقیت تغییر کرد.',
      });
    } catch (error) {
      setPasswordMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'تغییر رمز عبور انجام نشد. دوباره تلاش کنید.',
      });
    } finally {
      setPasswordBusy(false);
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
        <div role="tabpanel" id="profile-tabs-panel" aria-labelledby={`profile-tabs-tab-${tab}`}>
          <Students />
        </div>
      </div>
    );
  }
  if (tab === 'classes') {
    return (
      <div>
        <ProfileHeader tab={tab} setTab={handleTabChange} />
        <div role="tabpanel" id="profile-tabs-panel" aria-labelledby={`profile-tabs-tab-${tab}`}>
          <Classes />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <ProfileHeader tab={tab} setTab={handleTabChange} />

      <div role="tabpanel" id="profile-tabs-panel" aria-labelledby={`profile-tabs-tab-${tab}`}>
        <section className="relative lens overflow-hidden rounded-3xl p-5 sm:p-7">
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
              <Button
                onClick={save}
                disabled={status.type === 'saving' || status.type === 'uploading'}
                isLoading={status.type === 'saving'}
                icon={<Save className="h-4 w-4" aria-hidden="true" />}
              >
                {status.type === 'saving' ? 'در حال ذخیره…' : 'ذخیره تغییرات'}
              </Button>
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
          <Card glassLayer="light" className="relative rounded-3xl space-y-5">
            <PageHeader
              level={2}
              icon={<UserRound className="h-5 w-5" />}
              title="اطلاعات دبیر"
              subtitle="اطلاعاتی که در پنل و آزمون‌ها نمایش داده می‌شود."
            />
            <Input
              label="نام و نام خانوادگی"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Input
              label="درس یا دروس تخصصی"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="مثلاً ریاضی و فیزیک"
            />
            <Textarea
              label="درباره من"
              rows={4}
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              placeholder="معرفی کوتاه برای نمایش در کنار آزمون‌ها"
              maxLength={1000}
              maxCount={1000}
              className="min-h-24 leading-7"
            />

            <div>
              <p className="mb-2 block text-caption md:text-label font-bold text-[var(--color-text-secondary)]">
                مدارس محل تدریس
              </p>
              <div className="space-y-2">
                {schools.map((school, index) => (
                  <div key={school.id} className="flex items-center gap-2">
                    <div className="mt-0 flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-[var(--color-glass-light-stroke)] bg-[var(--color-glass-panel-fill)] px-3">
                      <School
                        className="h-4 w-4 shrink-0 text-[var(--color-ink)]"
                        aria-hidden="true"
                      />
                      <span className="flex-1 truncate">{school.name}</span>
                      {index === 0 && (
                        <span className="text-caption text-[var(--color-text-tertiary)]">اصلی</span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSchool(school)}
                      className="text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]"
                    >
                      حذف
                    </Button>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <Input
                  wrapperClassName="flex-1"
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
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={addSchool}
                  icon={<Plus className="h-4 w-4" aria-hidden="true" />}
                >
                  افزودن
                </Button>
              </div>
            </div>
          </Card>

          <Card glassLayer="light" className="relative rounded-3xl">
            <PageHeader
              level={2}
              icon={<CalendarDays className="h-5 w-5" />}
              title="برنامه هفتگی"
              subtitle="کلاس‌ها، مدرسه و ساعت تدریس شما."
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
                  <div
                    key={item.id}
                    className="relative grid grid-cols-2 items-end gap-2 rounded-2xl border border-[var(--color-glass-light-stroke)] bg-[var(--color-glass-light-fill)] p-3 min-[900px]:grid-cols-[0.8fr_0.8fr_0.8fr_1.3fr_1.2fr_1.2fr_auto]"
                  >
                    <label className="min-w-0">
                      <span className={scheduleLabelClass}>روز</span>
                      <select
                        className={scheduleFieldClass}
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
                    <label className="min-w-0">
                      <span className={scheduleLabelClass}>شروع</span>
                      <input
                        type="time"
                        className={scheduleFieldClass}
                        value={item.startTime}
                        onChange={(event) =>
                          updateSchedule(item.id, { startTime: event.target.value })
                        }
                      />
                    </label>
                    <label className="min-w-0">
                      <span className={scheduleLabelClass}>پایان</span>
                      <input
                        type="time"
                        className={scheduleFieldClass}
                        value={item.endTime}
                        onChange={(event) =>
                          updateSchedule(item.id, { endTime: event.target.value })
                        }
                      />
                    </label>
                    <label className="min-w-0">
                      <span className={scheduleLabelClass}>مدرسه</span>
                      <select
                        className={scheduleFieldClass}
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
                    <label className="min-w-0">
                      <span className={scheduleLabelClass}>کلاس</span>
                      <input
                        className={scheduleFieldClass}
                        value={item.className}
                        onChange={(event) =>
                          updateSchedule(item.id, { className: event.target.value })
                        }
                        placeholder="مثلاً هفتم الف"
                      />
                    </label>
                    <label className="min-w-0">
                      <span className={scheduleLabelClass}>درس</span>
                      <input
                        className={scheduleFieldClass}
                        value={item.subject}
                        onChange={(event) =>
                          updateSchedule(item.id, { subject: event.target.value })
                        }
                        placeholder="نام درس"
                      />
                    </label>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setSchedule((current) => current.filter((row) => row.id !== item.id))
                      }
                      className="h-11 w-11 p-0 text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] min-[900px]:justify-self-end"
                      aria-label="حذف این کلاس از برنامه"
                      icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                    />
                  </div>
                ))
              ) : (
                <EmptyState
                  compact
                  icon={<CalendarDays className="h-7 w-7" />}
                  title="برنامه‌ای ثبت نشده است."
                  description="کلاس‌های هفتگی خود را اضافه کنید تا در این برنامه نمایش داده شوند."
                />
              )}
            </div>
            <Button
              variant="secondary"
              className="mt-4 w-full"
              onClick={addSchedule}
              icon={<Plus className="h-4 w-4" aria-hidden="true" />}
            >
              افزودن کلاس به برنامه
            </Button>
          </Card>
        </div>

        <Card glassLayer="light" className="relative rounded-3xl">
          <PageHeader
            level={2}
            icon={<Lock className="h-5 w-5" />}
            title="امنیت حساب"
            subtitle="رمز عبور ورود به پنل دبیر را تغییر دهید."
          />
          <form onSubmit={changePassword} className="mt-5 space-y-4">
            <Input
              label="رمز عبور جدید"
              type={showPassword ? 'text' : 'password'}
              dir="ltr"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="حداقل ۶ کاراکتر"
              icon={<Lock className="w-4 h-4" />}
              trailing={
                <IconButton
                  label={showPassword ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'}
                  size="xs"
                  radius="md"
                  tone="tertiary"
                  surface="plainMuted"
                  motion={false}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </IconButton>
              }
            />
            <Input
              label="تکرار رمز عبور جدید"
              type={showPassword ? 'text' : 'password'}
              dir="ltr"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="دوباره وارد کنید"
            />
            {passwordMessage && (
              <p
                role={passwordMessage.type === 'error' ? 'alert' : 'status'}
                aria-live="polite"
                className={
                  passwordMessage.type === 'error'
                    ? 'text-caption text-[var(--color-danger)] bg-[var(--color-danger-soft)] border border-[var(--color-danger)]/20 rounded-lg px-3 py-2'
                    : 'text-caption text-[var(--color-success)] bg-[var(--color-success-soft)] border border-[var(--color-success)]/20 rounded-lg px-3 py-2'
                }
              >
                {passwordMessage.text}
              </p>
            )}
            <Button
              type="submit"
              isLoading={passwordBusy}
              disabled={passwordBusy}
              icon={<Save className="h-4 w-4" aria-hidden="true" />}
            >
              {passwordBusy ? 'در حال تغییر…' : 'تغییر رمز عبور'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

function ProfileHeader({ tab, setTab }: { tab: ProfileTab; setTab: (tab: ProfileTab) => void }) {
  const tabs: Array<{ id: ProfileTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'پروفایل', icon: <UserRound className="h-4 w-4" /> },
    { id: 'students', label: 'دانش‌آموزان', icon: <Users className="h-4 w-4" /> },
    { id: 'classes', label: 'کلاس‌ها', icon: <GraduationCap className="h-4 w-4" /> },
  ];
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-heading-2 font-black">مرکز دبیر و کلاس‌ها</h1>
        <p className="mt-1 text-caption text-[var(--color-text-tertiary)]">
          پروفایل، دانش‌آموزان و برنامه تدریس در یک مکان
        </p>
      </div>
      <Tabs
        tabs={tabs}
        activeTab={tab}
        onChange={(id) => setTab(id as ProfileTab)}
        className="w-full sm:w-auto"
        ariaLabel="بخش‌های پروفایل دبیر"
        idPrefix="profile-tabs"
      />
    </div>
  );
}
