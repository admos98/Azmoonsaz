/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Automated accessibility gate — axe-core over the component library and
 * the provider-free Login shell.
 *
 * Fails on violations of impact >= moderate. Known-polish findings go in
 * AXE_KNOWN_ISSUES with an expiry date — the list may only shrink (same
 * ratchet trick as the size gate). Full pages needing TeacherProvider are
 * covered by the Playwright pass; jsdom axe covers primitives + Login.
 */
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import 'vitest-axe/extend-expect';
import { describe, expect, it, vi } from 'vitest';
import {
  Button,
  Card,
  Dropdown,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  StatCard,
  Table,
  Tabs,
  Textarea,
  ToastStack,
  Toast,
  Toggle,
} from '../../ui';
import { BubbleLoader } from '../../components/BubbleLoader';
import Login from '../../pages/teacher/Login';

// ruleId -> expiry YYYY-MM-DD + reason. Delete entries, never extend dates.
const AXE_KNOWN_ISSUES: Record<string, { until: string; reason: string }> = {
  // (empty — fill only with dated, shrinking entries)
};

const activeKnownIssues = Object.entries(AXE_KNOWN_ISSUES).filter(
  ([, v]) => v.until >= new Date().toISOString().slice(0, 10),
);

async function expectAccessible(element: HTMLElement, label: string) {
  const results = await axe(element, {
    rules: Object.fromEntries(activeKnownIssues.map(([rule]) => [rule, { enabled: false }])),
  });
  const serious = results.violations.filter((v) =>
    ['moderate', 'serious', 'critical'].includes(v.impact ?? ''),
  );
  expect(serious, `${label}: ${JSON.stringify(serious.map((v) => v.id), null, 2)}`).toEqual([]);
}

describe('axe — library primitives', () => {
  it('PageHeader + StatCard + Card have no violations', async () => {
    const { container } = render(
      <main>
        <PageHeader title="مدیریت آزمون‌ها" subtitle="زیرعنوان" />
        <Card>
          <StatCard label="شرکت‌کنندگان" value="۱۲" unit="نفر" />
        </Card>
      </main>,
    );
    await expectAccessible(container, 'PageHeader/StatCard/Card');
  });

  it('form controls (Input, Textarea, Dropdown, Toggle) have no violations', async () => {
    const noop = () => {};
    const { container } = render(
      <main>
        <Input label="نام آزمون" placeholder="ریاضی" />
        <Textarea label="توضیحات" />
        <Dropdown value="a" onChange={noop} options={[{ value: 'a', label: 'الف' }]} label="درس" />
        <Toggle checked onChange={noop} label="ارسال خودکار" />
      </main>,
    );
    await expectAccessible(container, 'form controls');
  });

  it('Table + EmptyState + Tabs have no violations', async () => {
    const { container } = render(
      <main>
        <Tabs tabs={[{ id: 'a', label: 'الف' }]} activeTab="a" onChange={() => {}} />
        <Table
          headers={[{ key: 'name', label: 'نام' }]}
          data={[{ name: 'نمونه' }]}
          renderRow={(row) => (
            <tr key={row.name}>
              <td>{row.name}</td>
            </tr>
          )}
        />
        <EmptyState title="خالی" description="موردی نیست" />
      </main>,
    );
    await expectAccessible(container, 'Table/EmptyState/Tabs');
  });

  it('open Modal + ToastStack + BubbleLoader have no violations', async () => {
    const { container } = render(
      <main>
        <ToastStack>
          <Toast message="ذخیره شد" type="success" duration={60_000} />
        </ToastStack>
        <BubbleLoader />
        <Modal isOpen onClose={() => {}} title="نمونه">
          <Button>تایید</Button>
        </Modal>
      </main>,
    );
    await expectAccessible(container, 'Modal/Toast/BubbleLoader');
  });
});

describe('axe — Login shell', () => {
  it('Login form has no violations', async () => {
    const { container } = render(<Login onLoginSuccess={vi.fn()} />);
    await expectAccessible(container, 'Login');
  });
});
