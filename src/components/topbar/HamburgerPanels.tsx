/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The four hamburger dropdown panels (app info, profile, navigation,
 * exams/settings) with their staggered grow/shrink choreography.
 *
 * Extracted verbatim from src/components/Topbar.tsx.
 */
import { TheMark } from '../TheMark';
import { useTeacher } from '../../contexts/TeacherContext';

interface HamburgerPanelsProps {
 menuClosing: boolean;
 currentTab: string;
 onTabChange: (tab: string) => void;
 onLogout: () => void;
 closeMenu: () => void;
 hamburgerRect: DOMRect | null;
}

export function HamburgerPanels({
 menuClosing,
 currentTab,
 onTabChange,
 onLogout,
 closeMenu,
 hamburgerRect,
}: HamburgerPanelsProps) {
 const { teacher } = useTeacher();

  // Panels now FLOW inside one fixed container (flex column) — the old
  // estimated-heights stacking (panelHeights + computePanelTop) drifted from
  // real content, leaving dead space and overlaps (pics audit #10).
  const panelGap = 12; // px between panels
  // Transform origin relative to each panel: hamburger button center.
  // The button is above the container by hamburgerRect.height/2 + 12 (gap).
  const panelWidth = 280;
  const computeHamburgerTransformOrigin = (index: number) => {
    if (!hamburgerRect) return 'center top';
    const originX = `${panelWidth - hamburgerRect.width / 2}px`;
    const offset = index === 0 ? 0 : index * (panelGap + 4); // approximate offset for stacked panels
    const originY = `${-hamburgerRect.height / 2 - 12 - offset}px`;
    return `${originX} ${originY}`;
  };

 return (
 <>
            {/* Panel 1: App info + date */}
            <div
              className="lens lens--menu rounded-2xl overflow-hidden"
              style={{
                transformOrigin: computeHamburgerTransformOrigin(0),
                animation: menuClosing
                  ? 'shrinkToHamburger 0.22s cubic-bezier(0.4, 0, 0.2, 1) 0ms both'
                  : 'growFromHamburger 0.32s cubic-bezier(0.22, 1, 0.36, 1) 0ms both',
              }}
              id="hamburger-panel-1"
            >
              <div className="p-3 min-w-[240px]">
                <div className="flex items-center gap-3">
                  <TheMark variant="row" size={36} animated={false} />
                  <div>
                    <p className="text-body font-extrabold text-[var(--color-text-primary)]">
                      آزمون‌ساز
                    </p>
                    <p className="text-caption text-[var(--color-text-secondary)]">
                      پنل مدیریت دبیران
                    </p>
                  </div>
                </div>
                {/* date dropped (1H): the hero already owns ۱۲ مهر ۱۴۰۵ —
                    showing it twice on one screen is noise, not info */}
              </div>
            </div>

            {/* Panel 2: Teacher profile */}
            <div
              className="lens lens--menu rounded-2xl overflow-hidden"
              style={{
                transformOrigin: computeHamburgerTransformOrigin(1),
                animation: menuClosing
                  ? 'shrinkToHamburger 0.22s cubic-bezier(0.4, 0, 0.2, 1) 0ms both'
                  : 'growFromHamburger 0.32s cubic-bezier(0.22, 1, 0.36, 1) 45ms both',
              }}
              id="hamburger-panel-2"
            >
              <button
                type="button"
                onClick={() => {
                  onTabChange('profile');
                  closeMenu();
                }}
                className="btn-glass btn-glass--bare p-3 min-w-[240px] w-full text-right cursor-pointer"
              >
                <span className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-[var(--color-accent-solid)]/10 border border-[var(--color-accent)]/20 flex items-center justify-center overflow-hidden">
                    {teacher?.avatarUrl ? (
                      <img
                        loading="eager"
                        decoding="async"
                        src={teacher.avatarUrl}
                        alt={teacher.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-caption text-[var(--color-accent)] font-bold">
                        {teacher?.name?.[0] || '?'}
                      </span>
                    )}
                  </span>
                  <span className="flex-1 overflow-hidden block">
                    <span className="text-body font-bold text-[var(--color-text-primary)] truncate block">
                      {teacher?.name || '...'}
                    </span>
                    <span className="text-caption text-[var(--color-text-secondary)] truncate block">
                      {teacher?.schoolName || ''}
                    </span>
                  </span>
                </span>
              </button>
            </div>

            {/* Panel 3: Management options */}
            <nav
              aria-label="ناوبری اصلی"
              className="lens lens--menu rounded-2xl overflow-hidden"
              style={{
                transformOrigin: computeHamburgerTransformOrigin(2),
                animation: menuClosing
                  ? 'shrinkToHamburger 0.22s cubic-bezier(0.4, 0, 0.2, 1) 0ms both'
                  : 'growFromHamburger 0.32s cubic-bezier(0.22, 1, 0.36, 1) 90ms both',
              }}
              id="hamburger-panel-3"
            >
              <div className="p-3 min-w-[240px]">
                <button
                  type="button"
                  className={`w-full text-right flex items-center gap-3 p-2.5 rounded-lg text-label font-semibold cursor-pointer transition-all duration-300 ${
                    currentTab === 'dashboard'
                      ? 'btn-glass btn-glass--gold'
                      : 'btn-glass btn-glass--bare'
                  }`}
                  onClick={() => {
                    onTabChange('dashboard');
                    closeMenu();
                  }}
                  aria-current={currentTab === 'dashboard' ? 'page' : undefined}
                >
                  <span>داشبورد مدیریتی</span>
                </button>
                <button
                  type="button"
                  className={`w-full text-right flex items-center gap-3 p-2.5 rounded-lg text-label font-semibold cursor-pointer transition-all duration-300 ${currentTab === 'profile' ? 'btn-glass btn-glass--gold' : 'btn-glass btn-glass--bare'}`}
                  onClick={() => {
                    onTabChange('profile');
                    closeMenu();
                  }}
                  aria-current={currentTab === 'profile' ? 'page' : undefined}
                >
                  <span>پروفایل، دانش‌آموزان و کلاس‌ها</span>
                </button>
              </div>
            </nav>

            {/* Panel 4: Exam panel + settings */}
            <nav
              aria-label="ناوبری آزمون‌ها و تنظیمات"
              className="lens lens--menu rounded-2xl overflow-hidden"
              style={{
                transformOrigin: computeHamburgerTransformOrigin(3),
                animation: menuClosing
                  ? 'shrinkToHamburger 0.22s cubic-bezier(0.4, 0, 0.2, 1) 0ms both'
                  : 'growFromHamburger 0.32s cubic-bezier(0.22, 1, 0.36, 1) 135ms both',
              }}
              id="hamburger-panel-4"
            >
              <div className="p-3 min-w-[240px]">
                <button
                  type="button"
                  className={`w-full text-right flex items-center gap-3 p-2.5 rounded-lg text-label font-semibold cursor-pointer transition-all duration-300 ${
                    currentTab.startsWith('exams')
                      ? 'btn-glass btn-glass--gold'
                      : 'btn-glass btn-glass--bare'
                  }`}
                  onClick={() => {
                    onTabChange('exams');
                    closeMenu();
                  }}
                  aria-current={currentTab.startsWith('exams') ? 'page' : undefined}
                >
                  <span>آزمون‌ها</span>
                </button>
                <button
                  type="button"
                  className={`w-full text-right flex items-center gap-3 p-2.5 rounded-lg text-label font-semibold cursor-pointer transition-all duration-300 ${
                    currentTab === 'settings'
                      ? 'btn-glass btn-glass--gold'
                      : 'btn-glass btn-glass--bare'
                  }`}
                  onClick={() => {
                    onTabChange('settings');
                    closeMenu();
                  }}
                  aria-current={currentTab === 'settings' ? 'page' : undefined}
                >
                  <span>تنظیمات</span>
                </button>
                <button
                  type="button"
                  className="w-full text-right flex items-center gap-3 p-2.5 rounded-lg text-label font-semibold btn-glass btn-glass--danger cursor-pointer transition-all duration-300"
                  onClick={() => {
                    onLogout();
                    closeMenu();
                  }}
                >
                  <span>خروج از سامانه</span>
                </button>
              </div>
            </nav>
 </>
 );
}
