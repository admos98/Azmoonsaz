import { useState } from 'react';
import { HelpCircle, SlidersHorizontal } from 'lucide-react';
import Settings from './Settings';
import Questions from './Questions';
import QuestionBankHealth from '../../components/QuestionBankHealth';

export default function SettingsHub({ initialTab = 'system' }: { initialTab?: 'system'|'questions' }) {
  const [tab, setTab] = useState<'system'|'questions'>(initialTab);
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-heading-2 font-black">تنظیمات و منابع</h1><p className="text-caption text-[var(--color-text-tertiary)] mt-1">پیکربندی سامانه و مدیریت بانک سوالات</p></div>
      <div className="segmented-control">
        <button className={tab==='system'?'active':''} onClick={()=>setTab('system')}><SlidersHorizontal/>تنظیمات</button>
        <button className={tab==='questions'?'active':''} onClick={()=>setTab('questions')}><HelpCircle/>بانک سوالات</button>
      </div>
    </div>
    {tab === 'system' ? <Settings /> : <div className="space-y-6"><QuestionBankHealth /><Questions /></div>}
  </div>
}
