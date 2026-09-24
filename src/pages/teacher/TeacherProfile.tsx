import { useMemo, useRef, useState } from 'react';
import { Camera, CalendarDays, GraduationCap, Plus, Save, School, UserRound, Users } from 'lucide-react';
import { useTeacher } from '../../contexts/TeacherContext';
import { teacherProfileService } from '../../services/api';
import Students from './Students';
import Classes from './Classes';

type ProfileTab = 'overview' | 'students' | 'classes';
type ScheduleItem = { id: string; day: string; time: string; school: string; className: string; subject: string };

const days = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

export default function TeacherProfile({ initialTab = 'overview' }: { initialTab?: ProfileTab }) {
  const { teacher, updateTeacher } = useTeacher();
  const [tab, setTab] = useState<ProfileTab>(initialTab);
  const [name, setName] = useState(teacher?.name || '');
  const [subject, setSubject] = useState(teacher?.subject || '');
  const [bio, setBio] = useState(teacher?.bio || '');
  const [schools, setSchools] = useState<string[]>([]);
  const [newSchool, setNewSchool] = useState('');
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Sync the editable draft when the authenticated profile finishes loading.
  // State adjustment during render (not an effect): resyncs only when a new
  // teacher object arrives, never on local draft edits.
  const [syncedTeacher, setSyncedTeacher] = useState(teacher);
  if (teacher !== syncedTeacher) {
    setSyncedTeacher(teacher);
    setName(teacher?.name || '');
    setSubject(teacher?.subject || '');
    setBio(teacher?.bio || '');
    setSchools(teacher?.schools?.map((s) => s.name) || (teacher?.schoolName ? [teacher.schoolName] : []));
    setSchedule((teacher?.schedule || []).map((item) => ({ id: item.id, day: days[item.day] || 'شنبه', time: item.startTime, school: item.schoolName, className: item.className, subject: item.subject })));
  }
  const save = async () => {
    setSaving(true); setMessage('');
    try {
      const updated = await teacherProfileService.save({ name, subject, bio, avatarUrl: teacher?.avatarUrl, schools: schools.map((school, index) => ({ id: '', name: school, isPrimary: index === 0 })), schedule: schedule.map((item) => ({ id: item.id, day: Math.max(0, days.indexOf(item.day)), startTime: item.time, schoolName: item.school, className: item.className, subject: item.subject })) });
      updateTeacher(updated); setMessage('تغییرات با موفقیت در حساب شما ذخیره شد.');
    } catch { setMessage('ذخیره اطلاعات انجام نشد. دوباره تلاش کنید.'); }
    finally { setSaving(false); }
  };
  const addSchedule = () => setSchedule((s) => [...s, { id: crypto.randomUUID(), day: 'شنبه', time: '08:00', school: schools[0] || '', className: '', subject }]);
  const upcoming = useMemo(() => schedule.slice(0, 4), [schedule]);

  if (tab === 'students') return <div><ProfileHeader tab={tab} setTab={setTab} /><Students /></div>;
  if (tab === 'classes') return <div><ProfileHeader tab={tab} setTab={setTab} /><Classes /></div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <ProfileHeader tab={tab} setTab={setTab} />
      <section className="profile-cover glx overflow-hidden rounded-[28px] p-5 sm:p-7">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <button onClick={() => fileRef.current?.click()} className="relative group shrink-0" aria-label="تغییر تصویر پروفایل">
            {teacher?.avatarUrl ? <img src={teacher.avatarUrl} alt={teacher?.name || 'تصویر پروفایل'} className="w-24 h-24 rounded-3xl object-cover ring-4 ring-white/50" /> : <div className="w-24 h-24 rounded-3xl bg-[var(--color-ink)] text-white grid place-items-center text-heading-1 font-black">{teacher?.name?.[0] || 'م'}</div>}
            <span className="absolute -bottom-2 -left-2 w-9 h-9 rounded-xl bg-[var(--color-gold)] text-[var(--color-ink)] grid place-items-center shadow-md"><Camera className="w-4 h-4" /></span>
          </button>
          <input ref={fileRef} hidden type="file" accept="image/*" onChange={async (e) => { const f=e.target.files?.[0]; if(!f) return; setMessage('در حال بارگذاری تصویر…'); try { const avatarUrl = await teacherProfileService.uploadAvatar(f); updateTeacher({avatarUrl}); setMessage('تصویر بارگذاری شد؛ برای ثبت پروفایل، ذخیره را بزنید.'); } catch { setMessage('بارگذاری تصویر انجام نشد.'); } }} />
          <div className="flex-1">
            <p className="text-micro font-bold text-[var(--color-accent)] mb-1">پروفایل حرفه‌ای دبیر</p>
            <h1 className="text-heading-1 font-black">{teacher?.name || 'پروفایل دبیر'}</h1>
            <p className="text-label text-[var(--color-text-secondary)] mt-2">{subject || 'درس تخصصی ثبت نشده'} · {schools.length ? `${schools.length} مدرسه` : 'مدرسه‌ای ثبت نشده'}</p>
          </div>
          <div className="flex flex-col items-end gap-2"><button onClick={save} disabled={saving} className="btn-brand disabled:opacity-60"><Save className="w-4 h-4" /> {saving ? 'در حال ذخیره…' : 'ذخیره تغییرات'}</button>{message && <span className="text-micro text-[var(--color-text-secondary)]">{message}</span>}</div>
        </div>
      </section>

      <div className="grid lg:grid-cols-[1.05fr_.95fr] gap-6">
        <section className="glx panel-shell space-y-5">
          <div className="section-title"><UserRound /><div><h2>اطلاعات دبیر</h2><p>اطلاعاتی که در پنل و آزمون‌ها نمایش داده می‌شود.</p></div></div>
          <label className="field-label">نام و نام خانوادگی<input className="profile-input" value={name} onChange={e=>setName(e.target.value)} /></label>
          <label className="field-label">درس یا دروس تخصصی<input className="profile-input" value={subject} onChange={e=>setSubject(e.target.value)} placeholder="مثلاً ریاضی و فیزیک" /></label>
          <label className="field-label">درباره من<textarea className="profile-input min-h-[96px] py-3 leading-7 resize-y" value={bio} onChange={e=>setBio(e.target.value)} placeholder="معرفی کوتاه برای نمایش در کنار آزمون‌ها" maxLength={1000} /></label>
          <div>
            <p className="field-label mb-2">مدارس محل تدریس</p>
            <div className="space-y-2">{schools.map((school,i)=><div key={i} className="flex gap-2"><div className="profile-input flex-1 flex items-center gap-2"><School className="w-4 h-4 text-[var(--color-accent)]" />{school}</div><button onClick={()=>setSchools(s=>s.filter((_,x)=>x!==i))} className="px-3 text-[var(--color-danger)]">حذف</button></div>)}</div>
            <div className="flex gap-2 mt-3"><input className="profile-input flex-1" value={newSchool} onChange={e=>setNewSchool(e.target.value)} placeholder="نام مدرسه جدید"/><button className="btn-soft" onClick={()=>{if(newSchool.trim()){setSchools([...schools,newSchool.trim()]);setNewSchool('')}}}><Plus className="w-4 h-4"/> افزودن</button></div>
          </div>
        </section>

        <section className="glx panel-shell">
          <div className="section-title mb-5"><CalendarDays /><div><h2>تقویم هفتگی</h2><p>کلاس‌ها، مدرسه و ساعت تدریس شما.</p></div></div>
          <div className="grid grid-cols-7 gap-1 mb-5">{days.map(d=><div key={d} className="text-center py-2 rounded-xl glx-inset text-micro">{d.slice(0,2)}</div>)}</div>
          <div className="space-y-3">{upcoming.length ? upcoming.map((item,index)=><div key={item.id} className="schedule-row">
            <select value={item.day} onChange={e=>setSchedule(s=>s.map((x,i)=>i===index?{...x,day:e.target.value}:x))}>{days.map(d=><option key={d}>{d}</option>)}</select>
            <input type="time" value={item.time} onChange={e=>setSchedule(s=>s.map((x,i)=>i===index?{...x,time:e.target.value}:x))}/>
            <input placeholder="کلاس / مدرسه" value={item.className} onChange={e=>setSchedule(s=>s.map((x,i)=>i===index?{...x,className:e.target.value}:x))}/>
          </div>) : <div className="empty-quiet"><CalendarDays className="w-7 h-7"/><p>برنامه‌ای ثبت نشده است.</p></div>}</div>
          <button className="btn-soft w-full justify-center mt-4" onClick={addSchedule}><Plus className="w-4 h-4"/> افزودن کلاس به برنامه</button>
        </section>
      </div>
    </div>
  );
}

function ProfileHeader({tab,setTab}:{tab:ProfileTab;setTab:(t:ProfileTab)=>void}){
 return <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-heading-2 font-black">مرکز دبیر و کلاس‌ها</h1><p className="text-caption text-[var(--color-text-tertiary)] mt-1">پروفایل، دانش‌آموزان و برنامه تدریس در یک مکان</p></div><div className="segmented-control"><button onClick={()=>setTab('overview')} className={tab==='overview'?'active':''}><UserRound/>پروفایل</button><button onClick={()=>setTab('students')} className={tab==='students'?'active':''}><Users/>دانش‌آموزان</button><button onClick={()=>setTab('classes')} className={tab==='classes'?'active':''}><GraduationCap/>کلاس‌ها</button></div></div>
}
