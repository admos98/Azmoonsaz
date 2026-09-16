# Liquid Glass Redesign — ExamForge (آزمون‌ساز)

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Redesign the ExamForge teacher dashboard with Apple-inspired liquid glass design language while fixing all audit findings (nonexistent Tailwind classes, missing skeletons, zero a11y, native alerts, hardcoded data, no mobile sidebar, triple API calls).

**Architecture:** Redesign flows bottom-up: token system → base components → shell (sidebar/topbar) → pages. Every file touched once. Bug fixes baked into the redesign pass, not separate.

**Tech Stack:** React 19, Vite 6, Tailwind CSS v4 (`@tailwindcss/vite`), motion (framer-motion successor), lucide-react, Vazirmatn font, TypeScript.

---

## Design System: Liquid Glass + The Mark

### Brand Identity: The Mark (علامت)

The logo is four answer bubbles — three empty, one gold-filled. It IS the product's core action: marking an answer on an exam sheet. In Persian, "علامت زدن" means "to mark (an answer)." The brand identity and the UI interaction are the same thing.

**Mark SVG component** (`src/components/TheMark.tsx`):
- Row variant: 4 circles horizontal (wordmark/header)
- Grid variant: 3×3 circles (app icon)
- Palette variant: navigation dots in question UI
- Core variant: single circle with dot (favicon)
- Colors: `--color-ink: #221E4A` (circles), `--color-gold: #F5B301` (filled = answered)

**Living in the product:**
- Question option selection: empty circle → gold fill animation
- Exam progress: row of bubbles, gold = answered, empty = pending
- Exam status: draft = all empty, active = filling, graded = all gold
- Sidebar logo: TheMark row + "آزمون‌ساز" text
- Favicon: single bubble with gold center dot

### Color Tokens (in `@theme`)

Brand colors from The Mark integrated with the glass system:

```
--color-glass-surface:     rgba(255, 255, 255, 0.72)
--color-glass-surface-dim: rgba(255, 255, 255, 0.45)
--color-glass-border:      rgba(255, 255, 255, 0.40)
--color-glass-highlight:   rgba(255, 255, 255, 0.60)
--color-glass-dark:        rgba(34, 30, 74, 0.88)     /* ink-tinted */
--color-glass-dark-border: rgba(255, 255, 255, 0.08)
--color-glass-dark-highlight: rgba(255, 255, 255, 0.06)

--color-surface-primary:   #FFFFFF
--color-surface-secondary: #F7F1E4  /* warm cream from brand */
--color-surface-tertiary:  #F1F5F9

--color-accent:            #4F46E5  /* indigo — primary actions */
--color-accent-soft:       #EEF2FF
--color-gold:              #F5B301  /* The Mark — answered/completed */
--color-gold-soft:         #FEF9E7
--color-ink:               #221E4A  /* The Mark — dark circles, deep indigo */
--color-success:           #059669  /* emerald */
--color-warning:           #D97706  /* amber */
--color-danger:            #DC2626  /* rose */

--color-text-primary:      #221E4A  /* ink — matches brand */
--color-text-secondary:    #6B6489  /* muted — from brand */
--color-text-tertiary:     #94A3B8
--color-text-on-dark:      #F8FAFC
--color-text-on-dark-secondary: #94A3B8
```

### Typography Scale

```
Display:   Vazirmatn 800, 28px/1.2  (hero greetings)
Headline:  Vazirmatn 700, 20px/1.3  (page titles)
Title:     Vazirmatn 700, 16px/1.4  (card headings)
Body:      Vazirmatn 500, 14px/1.6  (content)
Caption:   Vazirmatn 600, 12px/1.4  (labels, badges)
Micro:     Vazirmatn 600, 11px/1.3  (stat numbers, timestamps)
```

### Spacing Grid: 4px base

Consistent use: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`. No in-between values like `gap-3.5` or `p-4.5`.

### Border Radius

```
radius-sm:    8px   (badges, small buttons)
radius-md:    12px  (inputs, cards)
radius-lg:    16px  (modals, panels)
radius-xl:    20px  (sidebar, hero)
radius-full:  9999px (avatars, pills)
```

### Glass Surfaces

Three glass tiers, each with background + border + subtle inner highlight:

| Tier | Use | bg | border | shadow |
|------|-----|----|--------|--------|
| Glass-1 | Cards, panels on light bg | `glass-surface` | `glass-border` | `0 1px 2px rgba(0,0,0,0.04)` |
| Glass-2 | Elevated modals, dropdowns | `glass-surface` + stronger blur | `glass-border` | `0 8px 32px rgba(0,0,0,0.08)` |
| Glass-3 | Dark sidebar | `glass-dark` | `glass-dark-border` | none (edge glow via highlight) |

### Signature Element

**The Mark** is the signature. The four answer bubbles are everywhere:

- **Sidebar** — dark glass panel (ink-tinted, macOS-inspired) with TheMark logo at top
- Deep ink glass background with subtle inner glow at the top edge
- Active nav item: bright indigo pill with spring animation (scale + translate)
- Teacher profile: frosted circle avatar with ring glow
- Footer: dark glass with indigo accent shimmer
- **Question UI** — option bubbles that fill gold on selection (the "marking" moment)
- **Exam progress** — bubble row showing completion
- **Dashboard** — stat cards use bubble indicators for status

---

## Phase 0: Architectural Fixes (No Visual Change)

### Task 1: Create shared TeacherContext

**Objective:** Eliminate 4× parallel `getCurrentTeacher()` calls by providing teacher data via React context.

**Files:**
- Create: `src/contexts/TeacherContext.tsx`
- Modify: `src/App.tsx` (wrap shell in provider)
- Modify: `src/components/Sidebar.tsx` (consume context, remove own fetch)
- Modify: `src/components/Topbar.tsx` (consume context, remove own fetch)
- Modify: `src/pages/teacher/Dashboard.tsx` (consume context, remove own fetch)
- Modify: `src/pages/teacher/Settings.tsx` (consume context, remove own fetch)

**Step 1: Create TeacherContext**

```tsx
// src/contexts/TeacherContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Teacher } from '../types';
import { authService } from '../services/api';

interface TeacherContextValue {
  teacher: Teacher | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const TeacherContext = createContext<TeacherContextValue>({
  teacher: null,
  loading: true,
  refresh: async () => {},
});

export function TeacherProvider({ children }: { children: ReactNode }) {
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTeacher = async () => {
    setLoading(true);
    try {
      const t = await authService.getCurrentTeacher();
      setTeacher(t);
    } catch {
      setTeacher(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTeacher(); }, []);

  return (
    <TeacherContext.Provider value={{ teacher, loading, refresh: fetchTeacher }}>
      {children}
    </TeacherContext.Provider>
  );
}

export const useTeacher = () => useContext(TeacherContext);
```

**Step 2: Wrap App shell**

In `App.tsx`, wrap the teacher shell (lines 280-309) with `<TeacherProvider>`. The teacher fetch for onboarding check (line 63-70) should also consume this context instead of doing its own fetch.

**Step 3: Update Sidebar, Topbar, Dashboard, Settings**

Replace individual `authService.getCurrentTeacher()` calls and their local `useState<Teacher>` with `const { teacher } = useTeacher()`. Remove the `useEffect` that fetches in each file.

**Step 4: Verify**

```bash
npm run typecheck && npm run test
```

**Step 5: Commit**

```bash
git add -A && git commit -m "refactor: consolidate getCurrentTeacher into shared TeacherContext"
```

---

### Task 2: Remove mock data remnants from in-scope files

**Objective:** Remove hardcoded mock data and dead mock code from target files.

**Files:**
- Modify: `src/pages/teacher/Dashboard.tsx` (remove `parsedSampleStudents` hardcoded array, fix simulated Excel import)
- Modify: `src/App.tsx` (remove `mockExamRouteMatch` dead route, remove `customExams` state if unused)

**Step 1: Dashboard.tsx**

Remove `parsedSampleStudents` array (lines 93-98). The Excel import `handleConfirmImport` should either:
- Actually parse the uploaded file (preferred), or
- Show an error toast saying "Excel parsing not yet implemented"

For now, remove the hardcoded students and the fake `+۳ نفر` display. Replace the stat card subtitle with real data derived from `localStudents`.

**Step 2: App.tsx**

Remove the `mockExamRouteMatch` route block (lines 194-210). Remove `customExams` state and `handleAddNewExam` if only used by the mock route.

**Step 3: Verify**

```bash
npm run typecheck && npm run test && npm run build
```

**Step 4: Commit**

```bash
git add -A && git commit -m "chore: remove mock data remnants from in-scope files"
```

---

### Task 3: Add lazy route splitting

**Objective:** Code-split page components so only the active page loads initially.

**Files:**
- Modify: `src/App.tsx`

**Step 1: Convert imports to lazy**

```tsx
import React, { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('./pages/teacher/Dashboard'));
const Students = lazy(() => import('./pages/teacher/Students'));
const Classes = lazy(() => import('./pages/teacher/Classes'));
const Questions = lazy(() => import('./pages/teacher/Questions'));
const Exams = lazy(() => import('./pages/teacher/Exams'));
const NewExam = lazy(() => import('./pages/teacher/NewExam'));
const Settings = lazy(() => import('./pages/teacher/Settings'));
```

Keep `Login`, `Onboarding`, `ResetPassword`, `ExamPortal`, `SecureExamPortal` as static imports (they render on initial load or are standalone routes).

**Step 2: Wrap `renderTeacherContent` in `<Suspense>`**

```tsx
<Suspense fallback={<PageSkeleton />}>
  {renderTeacherContent()}
</Suspense>
```

Create a minimal `PageSkeleton` component (placeholder shimmer) — this also serves as the skeleton foundation for Task 8.

**Step 3: Verify**

```bash
npm run build && ls -la dist/assets/  # should show multiple JS chunks
```

**Step 4: Commit**

```bash
git add -A && git commit -m "perf: lazy-load teacher page components for code splitting"
```

---

## Phase 1: Design System Foundation

### Task 4: Define liquid glass tokens in `index.css`

**Objective:** Establish the complete token system via Tailwind v4 `@theme`, replacing all hardcoded values.

**Files:**
- Modify: `src/index.css`

**Step 1: Replace the `@theme` block**

```css
@import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap');
@import "tailwindcss";

@theme {
  /* Typography */
  --font-sans: "Vazirmatn", ui-sans-serif, system-ui, sans-serif;

  /* Spacing scale (4px base) */
  --spacing-px: 1px;
  --spacing-0: 0px;
  --spacing-0\.5: 2px;
  --spacing-1: 4px;
  --spacing-1\.5: 6px;
  --spacing-2: 8px;
  --spacing-3: 12px;
  --spacing-4: 16px;
  --spacing-5: 20px;
  --spacing-6: 24px;
  --spacing-8: 32px;
  --spacing-10: 40px;
  --spacing-12: 48px;
  --spacing-16: 64px;

  /* Border radius */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-2xl: 24px;
  --radius-full: 9999px;

  /* Colors — Surface */
  --color-surface-primary: #FFFFFF;
  --color-surface-secondary: #F8FAFC;
  --color-surface-tertiary: #F1F5F9;

  /* Colors — Glass */
  --color-glass-surface: rgba(255, 255, 255, 0.72);
  --color-glass-surface-dim: rgba(255, 255, 255, 0.45);
  --color-glass-border: rgba(255, 255, 255, 0.40);
  --color-glass-highlight: rgba(255, 255, 255, 0.60);
  --color-glass-dark: rgba(15, 23, 42, 0.82);
  --color-glass-dark-border: rgba(255, 255, 255, 0.08);
  --color-glass-dark-highlight: rgba(255, 255, 255, 0.06);

  /* Colors — Brand */
  --color-accent: #4F46E5;
  --color-accent-hover: #4338CA;
  --color-accent-soft: #EEF2FF;
  --color-accent-glow: rgba(79, 70, 229, 0.15);

  /* Colors — Semantic */
  --color-success: #059669;
  --color-success-soft: #ECFDF5;
  --color-warning: #D97706;
  --color-warning-soft: #FFFBEB;
  --color-danger: #DC2626;
  --color-danger-soft: #FEF2F2;

  /* Colors — Text */
  --color-text-primary: #0F172A;
  --color-text-secondary: #475569;
  --color-text-tertiary: #94A3B8;
  --color-text-on-dark: #F8FAFC;
  --color-text-on-dark-secondary: #94A3B8;
}

body {
  font-family: var(--font-sans);
  direction: rtl;
  text-align: right;
  background: var(--color-surface-secondary);
  color: var(--color-text-primary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Selection color */
::selection {
  background: var(--color-accent-soft);
  color: var(--color-accent);
}

/* Custom scrollbar — refined */
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 9999px; }
::-webkit-scrollbar-thumb:hover { background: #94A3B8; }

/* Glass utility classes */
.glass-1 {
  background: var(--color-glass-surface);
  backdrop-filter: blur(20px) saturate(1.8);
  -webkit-backdrop-filter: blur(20px) saturate(1.8);
  border: 1px solid var(--color-glass-border);
  box-shadow: 0 1px 2px rgba(0,0,0,0.04), inset 0 1px 0 var(--color-glass-highlight);
}

.glass-2 {
  background: var(--color-glass-surface);
  backdrop-filter: blur(40px) saturate(1.8);
  -webkit-backdrop-filter: blur(40px) saturate(1.8);
  border: 1px solid var(--color-glass-border);
  box-shadow: 0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 var(--color-glass-highlight);
}

.glass-3 {
  background: var(--color-glass-dark);
  backdrop-filter: blur(24px) saturate(1.5);
  -webkit-backdrop-filter: blur(24px) saturate(1.5);
  border-left: 1px solid var(--color-glass-dark-border);
  box-shadow: inset 0 1px 0 var(--color-glass-dark-highlight);
}

/* Skeleton shimmer animation */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton {
  background: linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: var(--radius-sm);
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Step 2: Remove old utility classes**

Remove `.glass-panel`, `.glass-panel-dark`, `.shiny-btn` from the old CSS.

**Step 3: Verify**

```bash
npm run build  # should compile without errors
```

**Step 4: Commit**

```bash
git add src/index.css && git commit -m "feat: define liquid glass token system in @theme"
```

---

### Task 5: Redesign base components in UIComponents.tsx

**Objective:** Rebuild the 15 exported components with the new glass design language, fixing all nonexistent Tailwind classes, adding proper ARIA, loading states, and keyboard support.

**Files:**
- Modify: `src/components/UIComponents.tsx`

This is the highest-impact single task. Every component that uses UIComponents inherits the new design.

**Components to redesign (in order):**

1. **Button** — Glass surface on hover, spring scale on press, visible focus ring using `--color-accent`, disabled state opacity
2. **Card** — `glass-1` surface, consistent `radius-lg`, no more `bg-white/80 backdrop-blur-sm border-white/30`
3. **Badge** — Fix all nonexistent color classes (`bg-indigo-55`, `border-emerald-110`), use semantic tokens
4. **StatusBadge** — Same fix
5. **Input** — Glass-1 surface on focus, proper RTL icon positioning, error state with `--color-danger`
6. **Select** — Match Input design
7. **Tabs** — Glass pill selector, smooth active indicator via motion
8. **Modal** — Glass-2 surface, proper focus trap, Escape to close, `aria-modal`, `role="dialog"`
9. **Drawer** — Glass-2, proper focus management, RTL-aware slide direction
10. **Stepper** — Fix RTL progress bar (grows right-to-left), consistent radius
11. **EmptyState** — Refined icon, glass surface, actionable
12. **ConfirmDialog** — Already wraps Modal, fix the `text-rose-605` nonexistent class
13. **FileDropzone** — Glass-1 surface, drag state with accent border
14. **Table** — Glass-1 header, proper `scope` on `<th>`, mobile card layout preserved
15. **ExamTimer** — Fix `text-indigo-650`/`text-rose-605`, add `aria-live="polite"` for countdown

**Key changes across all:**
- Replace ALL nonexistent Tailwind color classes with semantic token classes
- Add `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]` to all interactive elements
- Use consistent `radius-md` / `radius-lg` from the token system
- Remove `space-x-reverse` where `gap` is used
- Ensure all text uses `--color-text-primary/secondary/tertiary` instead of arbitrary slate shades

**New component to add:**

```tsx
/* ==========================================
   16. TOAST COMPONENT (replaces alert())
   ========================================== */
interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  onDismiss: () => void;
  duration?: number;
}

// Simple toast that slides in from top, auto-dismisses
// Uses AnimatePresence from motion/react
```

**Step 1-3:** Rewrite each component following the design tokens.

**Step 4: Verify**

```bash
npm run typecheck && npm run test
```

**Step 5: Commit**

```bash
git add src/components/UIComponents.tsx && git commit -m "feat: redesign base component library with liquid glass design system"
```

---

### Task 6: Create Skeleton components

**Objective:** Create reusable skeleton/shimmer components for loading states.

**Files:**
- Create: `src/components/Skeleton.tsx`

```tsx
export function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`skeleton h-4 rounded-md ${className}`} />;
}

export function SkeletonCircle({ size = 40 }: { size?: number }) {
  return <div className="skeleton rounded-full" style={{ width: size, height: size }} />;
}

export function SkeletonCard() {
  return (
    <div className="glass-1 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <SkeletonLine className="w-1/3" />
        <SkeletonCircle size={32} />
      </div>
      <SkeletonLine className="w-1/2 h-8" />
      <SkeletonLine className="w-2/3" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero skeleton */}
      <div className="skeleton rounded-xl h-40 w-full" />
      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
      {/* Content area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 skeleton rounded-xl h-64" />
        <div className="skeleton rounded-xl h-64" />
      </div>
    </div>
  );
}
```

**Commit:**
```bash
git add src/components/Skeleton.tsx && git commit -m "feat: add skeleton loading components"
```

---

## Phase 2: Shell Redesign

### Task 7: Redesign Sidebar

**Objective:** Rebuild sidebar as dark glass panel with grouped navigation, mobile collapse, and full accessibility.

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/App.tsx` (add mobile sidebar toggle state, adjust layout offset)

**Design spec:**

```
┌─────────────────────────────┐
│ ░░░ glass-3 dark surface ░░░│
│                             │
│  [Logo]  آزمون‌ساز          │  ← frosted logo area
│                             │
│  ┌─── Teacher Profile ───┐  │
│  │ [Avatar] name/school  │  │  ← glass-1 inset
│  └───────────────────────┘  │
│                             │
│  ── مدیریت ──               │  ← section label (text-on-dark-secondary)
│  ▸ داشبورد                  │  ← active: indigo pill
│  ▸ کلاس‌ها                  │
│  ▸ دانش‌آموزان              │
│                             │
│  ── آزمون‌ها ──             │
│  ▸ سوالات                   │
│  ▸ آزمون‌ها                 │
│                             │
│  ── تنظیمات ──              │
│  ▸ تنظیمات                  │
│                             │
│  [اشتراک] [Switch] [Logout]│  ← footer
└─────────────────────────────┘
```

**Navigation grouping:**
```tsx
const navGroups = [
  {
    label: 'مدیریت',
    items: [
      { id: 'dashboard', label: 'داشبورد', icon: LayoutDashboard },
      { id: 'classes', label: 'کلاس‌ها', icon: GraduationCap },
      { id: 'students', label: 'دانش‌آموزان', icon: Users },
    ],
  },
  {
    label: 'آزمون‌ها',
    items: [
      { id: 'questions', label: 'سوالات', icon: HelpCircle },
      { id: 'exams', label: 'آزمون‌ها', icon: FileText },
    ],
  },
  {
    label: 'تنظیمات',
    items: [
      { id: 'settings', label: 'تنظیمات', icon: Settings },
    ],
  },
];
```

**Mobile behavior:**
- Below `md` (768px): sidebar hidden by default, hamburger button in Topbar opens it as a glass-2 overlay
- Overlay: backdrop click or Escape closes it
- Body scroll locked when open

**Accessibility:**
- `<nav aria-label="منوی اصلی">`
- Each group: `<div role="group" aria-label="مدیریت">`
- Active item: `aria-current="page"`
- Keyboard: arrow keys navigate between items

**App.tsx layout change:**
- Desktop: `mr-64` on main content (unchanged)
- Mobile: no `mr-64`, sidebar is overlay

**Commit:**
```bash
git add src/components/Sidebar.tsx src/App.tsx && git commit -m "feat: redesign sidebar — dark glass, grouped nav, mobile collapse, a11y"
```

---

### Task 8: Redesign Topbar

**Objective:** Glass topbar with real notifications, search, and accessibility.

**Files:**
- Modify: `src/components/Topbar.tsx`

**Design:**
- `glass-1` surface, sticky, `h-16` (reduced from h-20)
- Search input: glass-1 inset with focus glow
- Notification bell: real count from props (remove hardcoded `activeExamNotifications = 2`)
- Keyboard: Escape closes notification dropdown, focus trap inside dropdown
- Remove hardcoded notification content — show empty state or "ندارید" when 0

**Commit:**
```bash
git add src/components/Topbar.tsx && git commit -m "feat: redesign topbar — glass surface, a11y dropdown, remove hardcoded notifications"
```

---

### Task 9: Redesign App shell layout

**Objective:** Update the main layout container with proper responsive breakpoints.

**Files:**
- Modify: `src/App.tsx`

**Changes:**
- Add `<TeacherProvider>` wrapper
- Import and use `DashboardSkeleton` in `<Suspense>` fallback
- Mobile: conditional class for sidebar offset
- Replace `alert()` in `handleAddNewExam` with Toast (from UIComponents)
- Remove `customExams` state (mock remnant)

**Commit:**
```bash
git add src/App.tsx && git commit -m "feat: update app shell — teacher context, lazy routes, responsive layout, toast"
```

---

## Phase 3: Page Redesigns

### Task 10: Redesign Dashboard

**Objective:** Glass cards, real skeletons, real data, remove hardcoded values.

**Files:**
- Modify: `src/pages/teacher/Dashboard.tsx`

**Changes:**
- Hero banner: deep indigo glass with subtle gradient shimmer (the "signature" accent)
- Stat cards: glass-1 surfaces, real computed values (remove `+۳ نفر` hardcode)
- Quick actions: glass-1 buttons with icon + label, consistent grid
- Empty states: use redesigned `EmptyState` component with glass surface
- Loading state: `DashboardSkeleton` while data loads
- Replace all `alert()` with Toast
- Fix ALL nonexistent Tailwind classes (use semantic tokens)
- Question bank health section: glass-1 card with progress bars using semantic colors

**Commit:**
```bash
git add src/pages/teacher/Dashboard.tsx && git commit -m "feat: redesign dashboard — glass cards, real data, skeletons, no alerts"
```

---

### Task 11: Redesign Students page

**Objective:** Glass table/cards, proper loading, a11y.

**Files:**
- Modify: `src/pages/teacher/Students.tsx`

**Changes:**
- Table: glass-1 header row, consistent radius, proper `scope` on `<th>`
- Mobile cards: glass-1 surfaces, vertical stack
- Loading: skeleton rows while fetching
- Delete confirmation: use `ConfirmDialog` instead of `window.confirm`
- Replace `alert()` with Toast
- Fix nonexistent Tailwind classes
- Add `aria-label` on action buttons

**Commit:**
```bash
git add src/pages/teacher/Students.tsx && git commit -m "feat: redesign students page — glass table, skeletons, a11y"
```

---

### Task 12: Redesign Classes page

**Objective:** Glass cards, proper loading, replace window.confirm.

**Files:**
- Modify: `src/pages/teacher/Classes.tsx`

**Changes:**
- Class cards: glass-1 surfaces
- Delete: `ConfirmDialog` instead of `window.confirm`
- Loading skeleton
- Fix nonexistent Tailwind classes
- Add a11y labels

**Commit:**
```bash
git add src/pages/teacher/Classes.tsx && git commit -m "feat: redesign classes page — glass cards, confirm dialog, skeletons"
```

---

### Task 13: Redesign Settings page

**Objective:** Glass form layout, proper loading.

**Files:**
- Modify: `src/pages/teacher/Settings.tsx`

**Changes:**
- Form sections: glass-1 panels
- Inputs: use redesigned Input/Select components
- Loading skeleton while fetching teacher data
- Replace localStorage teacher save with API call (if available) or keep with proper error handling
- Fix nonexistent Tailwind classes

**Commit:**
```bash
git add src/pages/teacher/Settings.tsx && git commit -m "feat: redesign settings page — glass form panels, skeletons"
```

---

### Task 14: Redesign Questions page

**Objective:** Glass layout, replace alerts, fix classes.

**Files:**
- Modify: `src/pages/teacher/Questions.tsx`

**Changes:**
- Question list: glass-1 cards
- Delete confirmation: `ConfirmDialog`
- Loading skeleton
- Replace `alert()` with Toast
- Fix nonexistent Tailwind classes
- This is the largest file (1731 lines) — focus on shell/layout changes, don't rewrite question rendering logic

**Commit:**
```bash
git add src/pages/teacher/Questions.tsx && git commit -m "feat: redesign questions page — glass cards, confirm dialogs, no alerts"
```

---

### Task 15: Redesign Exams page + sub-pages

**Objective:** Glass layout across Exams, NewExam, ExamSettings, ExamResults, ExamPreview.

**Files:**
- Modify: `src/pages/teacher/Exams.tsx`
- Modify: `src/pages/teacher/NewExam.tsx`
- Modify: `src/pages/teacher/ExamSettings.tsx`
- Modify: `src/pages/teacher/ExamResults.tsx`
- Modify: `src/pages/teacher/ExamPreview.tsx`

**Changes (all files):**
- Glass-1 surfaces for content panels
- Replace all `alert()` with Toast (highest count: ExamResults has 4)
- Replace all `window.confirm()` with ConfirmDialog
- Fix nonexistent Tailwind classes
- Loading skeletons where applicable
- ExamResults: glass panels for grading interface

**Commit:**
```bash
git add src/pages/teacher/Exams.tsx src/pages/teacher/NewExam.tsx src/pages/teacher/ExamSettings.tsx src/pages/teacher/ExamResults.tsx src/pages/teacher/ExamPreview.tsx && git commit -m "feat: redesign exam pages — glass surfaces, toasts, confirm dialogs"
```

---

### Task 16: Redesign QuestionRenderer

**Objective:** Fix nonexistent classes in the shared question renderer.

**Files:**
- Modify: `src/components/QuestionRenderer.tsx`

**Changes:**
- Fix `border-slate-150` → semantic border token
- Fix `shadow-2xs`, `shadow-xs` → proper shadows
- Fix `text-slate-850` → `text-[var(--color-text-primary)]`
- Fix `border-teal-150` → use emerald or custom token
- Glass surface for question container
- Add `dir="rtl"` consistency check

**Commit:**
```bash
git add src/components/QuestionRenderer.tsx && git commit -m "fix: fix nonexistent Tailwind classes in QuestionRenderer, add glass surfaces"
```

---

## Phase 4: Verification & Polish

### Task 17: Global audit pass

**Objective:** Verify zero remaining nonexistent Tailwind classes, all alerts replaced, all confirmations use ConfirmDialog.

**Files:**
- All files in scope

**Step 1: Run the nonexistent class grep**
```bash
grep -rnE "slate-(150|250|450|650|750|850)|indigo-(55|150|650|805|850)|rose-(350|605)|emerald-(110|150)|amber-(150)" src --include="*.tsx"
```
Expected: zero results.

**Step 2: Verify no alert() remain in target files**
```bash
grep -rn "alert(" src/pages/teacher/ src/components/ src/App.tsx --include="*.tsx"
```
Expected: zero results.

**Step 3: Verify no window.confirm() remain**
```bash
grep -rn "window.confirm" src/pages/teacher/ --include="*.tsx"
```
Expected: zero results.

**Step 4: Run full verification**
```bash
npm run typecheck && npm run test && npm run build
```

**Step 5: Fix any issues found.**

**Commit:**
```bash
git add -A && git commit -m "chore: global audit pass — fix remaining class/alert/a11y issues"
```

---

### Task 18: Visual verification via browser

**Objective:** Live browser check of every redesigned page.

**Manual steps:**
1. `npm run dev` → open localhost:3000
2. Sign in with test credentials
3. Walk through: Dashboard, Students, Classes, Questions, Exams (list → new → settings → preview → results), Settings
4. Check: glass surfaces render, skeletons show on load, no broken colors, RTL correct, mobile responsive (resize to 375px)
5. Screenshot each page for comparison

**Commit:**
```bash
git add -A && git commit -m "chore: visual verification pass — all pages confirmed"
```

---

### Task 19: Update AGENTS.md

**Objective:** Fix stale documentation.

**Files:**
- Modify: `AGENTS.md`

**Changes:**
- Remove references to mock data (`src/mock/`, `src/mockData.ts`)
- Update "No ESLint configured" → ESLint is configured
- Document new design system tokens
- Document TeacherContext
- Add Toast component to UIComponents list

**Commit:**
```bash
git add AGENTS.md && git commit -m "docs: update AGENTS.md — remove stale mock refs, document new design system"
```

---

## Files Changed Summary

| Phase | File | Action |
|-------|------|--------|
| 0 | `src/contexts/TeacherContext.tsx` | Create |
| 0 | `src/components/Skeleton.tsx` | Create |
| 0 | `src/App.tsx` | Modify |
| 0 | `src/components/Sidebar.tsx` | Modify |
| 0 | `src/components/Topbar.tsx` | Modify |
| 0 | `src/pages/teacher/Dashboard.tsx` | Modify |
| 0 | `src/pages/teacher/Settings.tsx` | Modify |
| 1 | `src/index.css` | Modify |
| 1 | `src/components/UIComponents.tsx` | Modify |
| 2 | `src/components/Sidebar.tsx` | Modify |
| 2 | `src/components/Topbar.tsx` | Modify |
| 2 | `src/App.tsx` | Modify |
| 3 | `src/pages/teacher/Dashboard.tsx` | Modify |
| 3 | `src/pages/teacher/Students.tsx` | Modify |
| 3 | `src/pages/teacher/Classes.tsx` | Modify |
| 3 | `src/pages/teacher/Settings.tsx` | Modify |
| 3 | `src/pages/teacher/Questions.tsx` | Modify |
| 3 | `src/pages/teacher/Exams.tsx` | Modify |
| 3 | `src/pages/teacher/NewExam.tsx` | Modify |
| 3 | `src/pages/teacher/ExamSettings.tsx` | Modify |
| 3 | `src/pages/teacher/ExamResults.tsx` | Modify |
| 3 | `src/pages/teacher/ExamPreview.tsx` | Modify |
| 3 | `src/components/QuestionRenderer.tsx` | Modify |
| 4 | `AGENTS.md` | Modify |

**Total: 2 new files, 18 modified files**

---

## Risks & Tradeoffs

| Risk | Mitigation |
|------|-----------|
| Liquid glass `backdrop-filter` performance on low-end phones | Use `will-change: transform` sparingly, test on actual devices. Fallback: solid backgrounds if FPS drops. |
| Large UIComponents.tsx rewrite may break existing page-specific styling | Verify with `npm run typecheck && npm run test && npm run build` after each component. Pages that override component styles will need manual adjustment. |
| 1MB bundle even after lazy splitting | Pages like Questions (1731 lines) and ExamPortal (1821 lines) are massive. Further splitting those is future work. |
| `prefers-reduced-motion` kills ALL animations | The current global rule is too aggressive. Refine to only kill decorative animations, keep functional ones (page transitions, state changes). |
| Glass surfaces may not render well on all browsers | `backdrop-filter` has good support now (2026), but test in Safari, Chrome, Firefox. Fallback: solid semi-opaque backgrounds. |

---

## Open Questions

1. **Toast component placement:** Should toasts render in a portal at the document root, or inside the layout? Portal is cleaner but needs z-index coordination with modals.
2. **Dark mode:** The current design is light-only. The glass system supports dark mode natively (swap glass-1 ↔ glass-3), but it's not in scope. Keep tokens dark-ready?
3. **ExamPortal / SecureExamPortal:** These are student-facing and out of scope, but they contain the most localStorage usage and the largest files. Leave for a separate redesign pass?
4. **Fonts:** Vazirmatn alone (dropping Inter and JetBrains Mono from the import) simplifies the load. Mono font needed for ExamTimer — keep JetBrains Mono for that one use?
