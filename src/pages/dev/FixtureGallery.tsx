/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Dev-only material laboratory — route `/dev/fixtures`.
 *
 * Renders before auth and needs no Supabase, so every visual primitive can be
 * inspected in isolation: glass recipes, the elevation ladder, controls,
 * overlays, empty states, The Mark and the type scale.
 *
 * It exists so UI changes are compared instead of guessed at. Screenshot it at
 * 320 / 375 / 768 / 1024 / 1440 in light, dark and reduced motion before and
 * after any material change.
 */
import { useRef, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Dropdown,
  EmptyState,
  Input,
  Modal,
  StatusBadge,
  Tabs,
} from '../../components/UIComponents';
import { TheMark, MarkBubble } from '../../components/TheMark';
import { useTheme, type ThemePreference } from '../../contexts/ThemeContext';
import { useMotionPreference, type MotionPreference } from '../../contexts/MotionContext';

/* ─── layout helpers ─── */

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-heading-3 font-extrabold text-[var(--color-text-primary)]">{title}</h2>
        {hint ? <p className="text-caption text-[var(--color-text-tertiary)]">{hint}</p> : null}
      </header>
      {children}
    </section>
  );
}

/**
 * Deliberately busy backdrop. Glass has to stay readable over *content*, not
 * over a flat colour — if a recipe only looks good on an empty page it is not
 * ready.
 */
function TestBackdrop({ label }: { label: string }) {
  // Deliberately non-themed: this is a fixed, saturated reference patch used to
  // judge legibility over busy content, so it must not follow light/dark.
  return (
    <div
      className="rounded-2xl p-6"
      style={{
        background:
          'linear-gradient(135deg, rgb(99 102 241 / 0.55), rgb(245 179 1 / 0.45) 45%, rgb(4 120 87 / 0.5))',
      }}
    >
      <p className="text-caption font-bold" style={{ color: 'rgb(255 255 255 / 0.92)' }}>
        {label}
      </p>
      <p className="text-body" style={{ color: 'rgb(255 255 255 / 0.85)' }}>
        متن آزمایشی برای سنجش خوانایی روی سطح شیشه‌ای — the quick brown fox jumps over the lazy dog.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <span
          className="rounded-lg px-2 py-1 text-micro"
          style={{ background: 'rgb(0 0 0 / 0.3)', color: 'rgb(255 255 255 / 0.95)' }}
        >
          ۱۲۳۴۵۶۷۸۹۰
        </span>
        <span
          className="rounded-lg px-2 py-1 text-micro"
          style={{ background: 'rgb(255 255 255 / 0.28)', color: 'rgb(255 255 255 / 0.95)' }}
        >
          تمرین ریاضی
        </span>
      </div>
    </div>
  );
}

const MATERIALS: Array<{ name: string; job: string; cls: string }> = [
  { name: 'glx', job: 'quiet content surface — cards, panels, topbar', cls: 'glx' },
  { name: 'glx-strong', job: 'modal / hero — the primary floating material', cls: 'glx-strong' },
  { name: 'glx-dark', job: 'brand field — ink surface with gold warmth', cls: 'glx-dark' },
  { name: 'glx-inset', job: 'concave — inputs, wells, nested controls', cls: 'glx-inset' },
  { name: 'glx-clear', job: 'barely-there — over already-quiet content', cls: 'glx-clear' },
];

const ELEVATIONS = [
  { id: 'elevation-0', job: 'canvas content' },
  { id: 'elevation-1', job: 'quiet content card' },
  { id: 'elevation-2', job: 'raised interactive card' },
  { id: 'elevation-3', job: 'floating menu / dropdown' },
  { id: 'elevation-4', job: 'modal / drawer' },
  { id: 'elevation-brand', job: 'hero / brand field' },
];

const TYPE_ROLES = [
  { role: 'text-display', sample: 'آزمون‌ساز', note: '32–40 / 800' },
  { role: 'text-heading-1', sample: 'داشبورد معلم', note: '24–28 / 800' },
  { role: 'text-heading-2', sample: 'برنامه هفتگی', note: '20 / 700' },
  { role: 'text-heading-3', sample: 'آزمون‌های اخیر', note: '18 / 700' },
  { role: 'text-body', sample: 'متن اصلی صفحه برای خواندن طولانی', note: '15–16 / 400' },
  { role: 'text-label', sample: 'عنوان فیلد', note: '14 / 600' },
  { role: 'text-caption', sample: 'اطلاعات تکمیلی', note: '13 / 600' },
  { role: 'text-micro', sample: 'برچسب کوچک', note: '12 / 650' },
];

/* ─── page ─── */

export default function FixtureGallery() {
  const { preference, setPreference } = useTheme();
  const { motionPreference, setMotionPreference: setMotion } = useMotionPreference();

  const [tab, setTab] = useState('one');
  const [option, setOption] = useState('a');
  const [value, setValue] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Structural match for Tabs' internal TabItem (id + label, icon optional).
  const tabs = [
    { id: 'one', label: 'اول' },
    { id: 'two', label: 'دوم' },
    { id: 'three', label: 'سوم' },
  ];

  const options = [
    { value: 'a', label: 'کلاس اول' },
    { value: 'b', label: 'کلاس دوم' },
    { value: 'c', label: 'کلاس سوم', disabled: true },
  ];

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[var(--color-page-bg)] px-4 py-8 sm:px-8"
      data-testid="fixture-gallery"
    >
      <div className="mx-auto max-w-6xl space-y-10">
        <header className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <TheMark variant="core" size={40} animated={false} />
              <div>
                <h1 className="text-heading-1 font-extrabold text-[var(--color-text-primary)]">
                  آزمایشگاه مواد
                </h1>
                <p className="text-caption text-[var(--color-text-tertiary)]">
                  Material laboratory — dev-only, no backend required
                </p>
              </div>
            </div>
            <span className="rounded-full border border-[var(--color-glass-light-stroke)] px-3 py-1 text-micro font-bold text-[var(--color-text-tertiary)]">
              /dev/fixtures
            </span>
          </div>

          {/* theme + motion controls */}
          <div className="glx rounded-2xl p-4">
            <div className="flex flex-wrap gap-6">
              <div className="space-y-2">
                <p className="text-label font-bold text-[var(--color-text-secondary)]">پوسته</p>
                <div className="flex flex-wrap gap-2">
                  {(['light', 'dark', 'system'] as ThemePreference[]).map((p) => (
                    <Button
                      key={p}
                      size="sm"
                      variant={preference === p ? 'gold' : 'outline'}
                      onClick={() => setPreference(p)}
                    >
                      {p}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-label font-bold text-[var(--color-text-secondary)]">حرکت</p>
                <div className="flex flex-wrap gap-2">
                  {(['system', 'reduced'] as MotionPreference[]).map((m) => (
                    <Button
                      key={m}
                      size="sm"
                      variant={motionPreference === m ? 'gold' : 'outline'}
                      onClick={() => setMotion(m)}
                    >
                      {m}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* 1 ─ material recipes */}
        <Section
          title="۱. دستور پخت مواد"
          hint="Each recipe over a busy backdrop — judge contrast, edge sharpness and specular strength here."
        >
          <div className="space-y-4">
            <TestBackdrop label="Busy backdrop — recipes sit on this" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {MATERIALS.map((m) => (
                <div key={m.name} className={`${m.cls} rounded-3xl p-5`}>
                  <p className="text-label font-black text-[var(--color-gold)]">{m.name}</p>
                  <p className="text-caption text-[var(--color-text-tertiary)]">{m.job}</p>
                  <p className="mt-3 text-body text-[var(--color-text-primary)]">
                    خوانایی متن روی این سطح باید بدون تلاش انجام شود.
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* 2 ─ elevation ladder */}
        <Section
          title="۲. نردبان ارتفاع"
          hint="Target scale for phase 3 — every tier must differ from its neighbour in shadow, border and fill."
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {ELEVATIONS.map((e) => (
              <div
                key={e.id}
                className="rounded-2xl border border-[var(--color-glass-light-stroke)] bg-[var(--color-surface)] p-4 text-center"
              >
                <p className="text-micro font-bold text-[var(--color-text-secondary)]">{e.id}</p>
                <p className="mt-1 text-micro text-[var(--color-text-tertiary)]">{e.job}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* 3 ─ controls */}
        <Section title="۳. کنترل‌ها" hint="Variants, sizes and states.">
          <Card glassLayer="light" className="space-y-5 p-5">
            <div className="flex flex-wrap items-center gap-3">
              {(
                [
                  'primary',
                  'secondary',
                  'outline',
                  'ghost',
                  'danger',
                  'success',
                  'gold',
                  'indigo',
                ] as const
              ).map((v) => (
                <Button key={v} variant={v}>
                  {v}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">small</Button>
              <Button size="md">medium</Button>
              <Button size="lg">large</Button>
              <Button variant="outline" disabled>
                disabled
              </Button>
              <Button variant="primary" isLoading>
                loading
              </Button>
            </div>
            <Tabs tabs={tabs} activeTab={tab} onChange={setTab} />
          </Card>
        </Section>

        {/* 4 ─ fields */}
        <Section title="۴. فیلد‌ها" hint="Input, dropdown, empty and error states.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card glassLayer="light" className="space-y-4 p-5">
              <Input
                label="نام دانش‌آموز"
                placeholder="مثال: علی رضایی"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                helperText="نام کامل را وارد کنید."
              />
              <Input label="کد ملی" error="کد ملی معتبر نیست." placeholder="۰۰۱۲۳۴۵۶۷۸" />
            </Card>
            <Card glassLayer="light" className="space-y-4 p-5">
              <Dropdown
                label="کلاس"
                value={option}
                onChange={setOption}
                options={options}
                placeholder="انتخاب کنید"
              />
              <div className="glx-inset rounded-xl p-3">
                <p className="text-caption text-[var(--color-text-secondary)]">
                  Inset well — <code className="text-micro">glx-inset</code>
                </p>
              </div>
            </Card>
          </div>
        </Section>

        {/* 5 ─ status */}
        <Section
          title="۵. وضعیت‌ها"
          hint="Badges carry semantic colour — they must read in both themes."
        >
          <Card glassLayer="light" className="space-y-4 p-5">
            <div className="flex flex-wrap gap-2">
              {(
                ['primary', 'slate', 'success', 'warning', 'danger', 'info', 'accent'] as const
              ).map((v) => (
                <Badge key={v} variant={v}>
                  {v}
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  'draft',
                  'scheduled',
                  'active',
                  'completed',
                  'ongoing',
                  'submitted',
                  'graded',
                  'absent',
                ] as const
              ).map((s) => (
                <StatusBadge key={s} status={s} />
              ))}
            </div>
          </Card>
        </Section>

        {/* 6 ─ overlays */}
        <Section
          title="۶. لایه‌های شناور"
          hint="Open each one — the origin animation must grow from the trigger, never from the centre."
        >
          <Card glassLayer="light" className="flex flex-wrap gap-3 p-5">
            <Button
              ref={triggerRef as React.RefObject<HTMLButtonElement>}
              variant="primary"
              onClick={() => setModalOpen(true)}
            >
              باز کردن مودال
            </Button>
            <Button variant="outline" onClick={() => setConfirmOpen(true)}>
              باز کردن تأییدیه
            </Button>
            <Button variant="gold" onClick={() => setToast(true)}>
              نمایش اعلان
            </Button>
          </Card>
        </Section>

        {/* 7 ─ empty state */}
        <Section title="۷. حالت خالی" hint="An empty screen is an invitation to act.">
          <Card glassLayer="light" className="p-5">
            <EmptyState
              title="هنوز آزمونی ساخته نشده"
              description="اولین آزمون خود را بسازید تا نتایج اینجا نمایش داده شود."
              action={<Button variant="primary">ساخت آزمون</Button>}
            />
          </Card>
        </Section>

        {/* 8 ─ The Mark */}
        <Section
          title="۸. نشان"
          hint="Brand geometry — gold is always the third circle, never blurred."
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {(['core', 'row', 'grid', 'palette'] as const).map((v) => (
              <div
                key={v}
                className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--color-glass-light-stroke)] bg-[var(--color-surface)] p-4"
              >
                <TheMark variant={v} size={56} animated={false} />
                <span className="text-micro font-bold text-[var(--color-text-tertiary)]">{v}</span>
              </div>
            ))}
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--color-glass-light-stroke)] bg-[var(--color-surface)] p-4">
              <MarkBubble />
              <span className="text-micro font-bold text-[var(--color-text-tertiary)]">bubble</span>
            </div>
          </div>
        </Section>

        {/* 9 ─ type scale */}
        <Section
          title="۹. مقیاس تایپوگرافی"
          hint="Persian must stay comfortable — no false sophistication via tiny text."
        >
          <Card
            glassLayer="light"
            className="divide-y divide-[var(--color-glass-light-stroke)] p-5"
          >
            {TYPE_ROLES.map((t) => (
              <div
                key={t.role}
                className="flex flex-wrap items-baseline justify-between gap-3 py-3"
              >
                <span className={`${t.role} text-[var(--color-text-primary)]`}>{t.sample}</span>
                <span className="text-micro text-[var(--color-text-tertiary)]">
                  {t.role} — {t.note}
                </span>
              </div>
            ))}
          </Card>
        </Section>

        <footer className="pb-8 text-center text-micro text-[var(--color-text-tertiary)]">
          آزمایشگاه مواد — فاز صفر از بازطراحی رابط کاربری
        </footer>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="مودال آزمایشی"
        triggerRef={triggerRef}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              انصراف
            </Button>
            <Button variant="primary" onClick={() => setModalOpen(false)}>
              تأیید
            </Button>
          </>
        }
      >
        <p className="text-body text-[var(--color-text-primary)]">
          این مودال باید از دکمه‌ای که آن را باز کرده باز شود، نه از مرکز صفحه. پس‌زمینه فقط کمی
          تیره می‌شود و متن پشت آن خواندنی می‌ماند.
        </p>
      </Modal>

      <ConfirmDialog
        isOpen={confirmOpen}
        title="حذف کلاس"
        message="آیا از حذف این کلاس مطمئن هستید؟ این عمل قابل بازگشت نیست."
        confirmText="حذف"
        cancelText="انصراف"
        variant="danger"
        onConfirm={() => setConfirmOpen(false)}
        onCancel={() => setConfirmOpen(false)}
      />

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className="glx-strong rounded-2xl px-4 py-3">
            <p className="text-caption text-[var(--color-text-primary)]">
              تغییرات با موفقیت ذخیره شد.
            </p>
            <button
              type="button"
              className="mt-1 text-micro font-bold text-[var(--color-gold)]"
              onClick={() => setToast(false)}
            >
              بستن
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
