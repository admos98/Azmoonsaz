import { Suspense, lazy, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Cut } from '../../components/Cut';
import Settings from './Settings';
import QuestionBankHealth from '../../components/QuestionBankHealth';
import { Tabs } from '../../ui';

/* The question bank (~2,400 LOC) loads only when its tab opens — the
   settings-only visitor never downloads it. */
const Questions = lazy(() => import('./Questions'));

type SettingsTab = 'system' | 'questions';

export default function SettingsHub({
  initialTab = 'system',
  onNavigate,
}: {
  initialTab?: SettingsTab;
  onNavigate?: (tab: string) => void;
}) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);
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
        <Tabs
          tabs={[
            { id: 'system', label: 'تنظیمات', icon: <SlidersHorizontal aria-hidden="true" /> },
            { id: 'questions', label: 'بانک سوالات', icon: <Cut kind="questions" size={20} /> },
          ]}
          activeTab={tab}
          onChange={(id) => activate(id as SettingsTab)}
          className="w-full sm:w-auto"
          ariaLabel="بخش‌های تنظیمات"
          idPrefix="settings-tabs"
        />
      </div>
      {/* one dynamic panel: aria-labelledby follows the active tab */}
      <div
        role="tabpanel"
        id="settings-tabs-panel"
        aria-labelledby={`settings-tabs-tab-${tab}`}
        className="space-y-6"
      >
        {tab === 'system' ? (
          <Settings />
        ) : (
          <div className="space-y-6">
            <QuestionBankHealth />
            <Suspense
              fallback={
                <div
                  className="h-64 rounded-2xl lens skeleton"
                  role="status"
                  aria-label="در حال بارگذاری بانک سوالات"
                />
              }
            >
              <Questions />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
}
