import { useState } from 'react';
import { HelpCircle, SlidersHorizontal } from 'lucide-react';
import Settings from './Settings';
import Questions from './Questions';
import QuestionBankHealth from '../../components/QuestionBankHealth';

type SettingsTab = 'system' | 'questions';

export default function SettingsHub({
  initialTab = 'system',
  onNavigate,
}: {
  initialTab?: SettingsTab;
  onNavigate?: (tab: string) => void;
}) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const tabs: SettingsTab[] = ['system', 'questions'];
  const activate = (next: SettingsTab) => {
    setTab(next);
    onNavigate?.(next === 'system' ? 'settings' : 'questions');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-heading-2 font-black">تنظیمات و منابع</h1>
          <p className="mt-1 text-caption text-[var(--color-text-tertiary)]">
            پیکربندی سامانه و مدیریت بانک سوالات
          </p>
        </div>
        <div
          className="segmented-control"
          role="tablist"
          aria-label="بخش‌های تنظیمات"
          onKeyDown={(event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault();
            const current = tabs.indexOf(tab);
            const direction = event.key === 'ArrowLeft' ? 1 : -1;
            activate(tabs[(current + direction + tabs.length) % tabs.length]);
            requestAnimationFrame(() =>
              event.currentTarget.querySelector<HTMLElement>('[aria-selected="true"]')?.focus(),
            );
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'system'}
            tabIndex={tab === 'system' ? 0 : -1}
            className={tab === 'system' ? 'active' : ''}
            onClick={() => activate('system')}
          >
            <SlidersHorizontal aria-hidden="true" />
            تنظیمات
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'questions'}
            tabIndex={tab === 'questions' ? 0 : -1}
            className={tab === 'questions' ? 'active' : ''}
            onClick={() => activate('questions')}
          >
            <HelpCircle aria-hidden="true" />
            بانک سوالات
          </button>
        </div>
      </div>
      {tab === 'system' ? (
        <Settings />
      ) : (
        <div className="space-y-6">
          <QuestionBankHealth />
          <Questions />
        </div>
      )}
    </div>
  );
}
