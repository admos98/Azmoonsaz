/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Dev-only topbar harness (`/dev/topbar`). Renders the REAL Topbar with a
 * mocked teacher profile so the hover panels, notification dropdown and
 * hamburger menu can be inspected without a backend session. Never linked
 * from nav; same /dev/ gate as the material laboratory.
 */

import React from 'react';
import { TeacherProvider } from '../../contexts/TeacherContext';
import Topbar from '../../components/Topbar';

const MOCK_TEACHER = {
  id: 'dev-teacher',
  name: 'moslem.adib2019',
  email: 'dev@example.com',
  schoolName: 'دبیرستان نمونه',
};

/** Dense page content so panels read against the same background the real
 *  dashboard has: hero greeting + wide cards + long body copy. */
function DensePage() {
  return (
    <div className="px-4 lg:px-8 pt-4 space-y-6" dir="rtl">
      <section className="glx rounded-2xl p-6" id="dashboard-hero-banner">
        <div className="dashboard-hero-content relative z-10">
          <div className="dashboard-hero-copy text-right">
            <h2 className="text-[2rem] leading-tight font-extrabold text-[var(--color-text-primary)]">
              سلام، استاد moslem.adib2019 عزیز
            </h2>
            <p className="mt-1 text-[var(--color-text-secondary)]">
              امروز فعال و پاسخ‌برگ در صف تصحیح.
            </p>
          </div>
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 8 }, (_, i) => (
          <section key={i} className="glx rounded-2xl p-5">
            <h3 className="text-heading-3 font-bold text-[var(--color-text-primary)]">
              کارت آزمایشی {i + 1}
            </h3>
            <p className="mt-2 text-body text-[var(--color-text-secondary)]">
              متن پرکننده برای پس‌زمینه متراکم — پنل شیشه‌ای باید خوانا بماند.
            </p>
          </section>
        ))}
      </div>
      <div className="h-[60vh]" aria-hidden="true" />
    </div>
  );
}

export default function TopbarHarness() {
  return (
    <div id="app-teacher-shell" className="min-h-dvh" dir="rtl">
      <TeacherProvider initialTeacher={MOCK_TEACHER}>
        <div className="relative z-10 flex min-h-dvh flex-col pt-14" id="main-content-layout">
          <Topbar
            currentTab="dashboard"
            onTabChange={() => {}}
            onLogout={() => {}}
            onSelectExamForResults={() => {}}
          />
          <DensePage />
        </div>
      </TeacherProvider>
    </div>
  );
}
