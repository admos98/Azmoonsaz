import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BookOpen } from 'lucide-react';
import { questionService } from '../services/api';
import { Question } from '../types';

type HealthItem = { label: string; count: number };
function HealthBar({ items, total }: { items: HealthItem[]; total: number }) {
  return <div className="space-y-2">{items.map((item)=><div key={item.label} className="grid grid-cols-[70px_1fr_35px] items-center gap-3 text-caption"><span>{item.label}</span><div className="h-2.5 rounded-full bg-black/[.05] overflow-hidden"><div className="h-full rounded-full bg-[var(--color-ink)]" style={{width: total ? `${Math.max(3,item.count/total*100)}%` : '0%'}}/></div><b>{item.count}</b></div>)}</div>;
}

export default function QuestionBankHealth() {
  const [questions, setQuestions] = useState<Question[]>([]);
  useEffect(() => { questionService.getQuestions().then(setQuestions).catch(() => setQuestions([])); }, []);
  const data = useMemo(() => {
    const grades = ['هفتم', 'هشتم', 'نهم'].map((label) => ({ label, count: questions.filter((q) => q.grade === label).length }));
    const choice = questions.filter((q) => q.type === 'single_choice' || q.type === 'multiple_choice').length;
    const essay = questions.filter((q) => q.type === 'long_answer' || q.type === 'short_answer').length;
    return { grades, types: [{ label: 'تستی', count: choice }, { label: 'تشریحی', count: essay }, { label: 'سایر', count: Math.max(0, questions.length - choice - essay) }] };
  }, [questions]);
  return <section className="profile-panel space-y-5">
    <div className="profile-section-title"><BookOpen/><div><h2>سلامت بانک سوالات</h2><p>پوشش سوال‌ها بر اساس پایه و ساختار</p></div></div>
    <div className="grid md:grid-cols-2 gap-6"><div><h3 className="profile-field-title mb-3">پایه تحصیلی</h3><HealthBar items={data.grades} total={questions.length}/></div><div><h3 className="profile-field-title mb-3">نوع سوال</h3><HealthBar items={data.types} total={questions.length}/></div></div>
    {questions.length < 12 && <div className="flex gap-3 rounded-[14px] bg-[var(--color-warning-soft)] p-4 text-caption text-[var(--color-warning)]"><AlertTriangle className="w-4 h-4 shrink-0"/><span>برای ساخت آزمون‌های متنوع‌تر، سوال‌های بیشتری به بانک اضافه کنید.</span></div>}
  </section>;
}
