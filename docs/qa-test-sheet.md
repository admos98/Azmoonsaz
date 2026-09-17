# Manual QA Test Sheet — Liquid Glass Redesign

**Project**: آزمون‌ساز (ExamForge) teacher panel
**Date**: 2026-09-17
**Tester**: _____________
**How to run**: `npm run dev` → open http://localhost:3000 → login as teacher
**How to fill**: Change `[ ]` to `[x]` for pass, `[✗]` for fail, `[?]` for can't test. Add notes under any section.

---

## 1. Sidebar (پنل مدیریت)

### Desktop (≥1024px)
- [ ] Dark glass surface (deep ink-purple tint, NOT white like before)
- [ ] TheMark logo at top: 4 circles, 3rd one gold-filled, pop animation on page load
- [ ] Logo area shows «آزمون‌ساز» + «پنل مدیریت دبیران» in white text
- [ ] Teacher profile card shows name + school, glass-on-glass style
- [ ] Nav grouped into 3 sections with small gray labels: مدیریت / آزمون‌ها / تنظیمات
- [ ] Active item: white text + gold vertical bar on the LEFT edge + gold icon
- [ ] Hover: subtle white tint slides in, item shifts slightly
- [ ] Logout button: red tint, at bottom
- [ ] Switch role button: «بخش دانش‌آموزی»

### Mobile (<1024px)
- [ ] Sidebar hidden; hamburger button visible top-left, glass style
- [ ] Tap hamburger → sidebar slides in from right over dimmed backdrop
- [ ] Backdrop tap closes sidebar
- [ ] X button inside sidebar closes it
- [ ] Selecting a nav item closes the sidebar automatically
- [ ] Content is not shifted/squashed behind the open sidebar

## 2. Topbar

- [ ] Frosted glass strip (page content visible through it when scrolling)
- [ ] Page title + Persian date (right side on desktop)
- [ ] Search input: rounded pill, indigo focus ring
- [ ] Notification bell: red pulsing dot present
- [ ] Notification dropdown opens: glass panel, 2 items, «بستن» works
- [ ] Teacher name + avatar on the far side
- [ ] On mobile: search hidden, role-switch hidden, no horizontal overflow

## 3. Dashboard (داشبورد)

### Hero
- [ ] Dark ink banner with soft indigo + gold glows
- [ ] Faint TheMark watermark on the left side (desktop only)
- [ ] Greeting: «سلام، استاد [name] عزیز»
- [ ] Both buttons work: «طراحی آزمون نو» → NewExam, «افزودن سوال جدید» → Questions

### Stats grid (5 cards)
- [ ] 5 cards in a row on desktop, stack on mobile
- [ ] Glass card style (translucent, not solid white)
- [ ] Icon colors: indigo (students), emerald (questions), amber (active exams), red (grading), indigo (scheduled)
- [ ] Numbers are Persian digits
- [ ] «+۳ نفر آماده تأیید» fake badge is GONE

### Quick actions
- [ ] Header reads «اقدامات سریع» — NO ⚡ emoji
- [ ] 5 tiles with colored icon chips
- [ ] «تصحیح تشریحی» tile is red-tinted, no pulsing animation
- [ ] Excel tile opens the import modal

### Sections
- [ ] Upcoming exams list: glass card, exam rows with status badges
- [ ] Recent submissions table: glass card, rows render (or empty state)
- [ ] Question bank health: two stacked bars with grade/type breakdown
- [ ] Class groups list: grade chips + student counts
- [ ] Tip card at bottom: Award icon, no gradient bg

### Excel import modal
- [ ] Backdrop dims + blurs the page
- [ ] Modal is glass with soft shadow
- [ ] Drag-drop zone accepts a file → progress bar runs
- [ ] Preview step shows placeholder text (real parsing not implemented)
- [ ] «تأیید و افزودن» shows a WARNING toast (not alert popup) — text: «ورود اکسل هنوز پیاده‌سازی نشده است.»

## 4. Students (دانش‌آموزان)

- [ ] Page loads without error, list renders in glass table/cards
- [ ] Add student form: validation errors show ERROR toasts (no alert popups)
- [ ] Duplicate national ID → error toast: «دانش‌آموزی با این کد ملی قبلاً ثبت شده است.»
- [ ] Delete student → ConfirmDialog modal (glass, red icon): «حذف پرونده دانش‌آموز»
  - [ ] Cancel does nothing
  - [ ] «حذف قطعی» removes student + success toast
- [ ] Filter/search controls work
- [ ] Mobile: table becomes stacked cards, readable

## 5. Classes (کلاس‌ها)

- [ ] Class list in glass cards
- [ ] Add class modal works
- [ ] Delete class → ConfirmDialog: «آیا از حذف این کلاس و تمامی ارتباطات آن با دانش‌آموزان مطمئن هستید؟»
  - [ ] Cancel safe, confirm deletes + list refreshes

## 6. Questions (بانک سوالات)

- [ ] Question list renders in glass surface
- [ ] Create question: missing title → warning toast (not alert)
- [ ] MCQ with <2 options → warning toast: «سوال چندگزینه‌ای حداقل دو گزینه لازم دارد.»
- [ ] Image upload → success toast
- [ ] Delete question → ConfirmDialog: «آیا از پاک کردن سوال ... غیرقابل بازگشت است.»
  - [ ] Confirm deletes + success toast
- [ ] Question renderer displays Persian text RTL correctly

## 7. Exams (آزمون‌ها)

- [ ] Exam list with filter tabs — tab labels have NO emojis (was 🔴🗓️✒️✅)
- [ ] Status badges render with correct colors
- [ ] Exam settings save → success toast
- [ ] Delete exam → error toast only on failure (check)
- [ ] Results sub-view loads

## 8. NewExam (طراحی آزمون)

- [ ] Wizard in glass container
- [ ] Step 1: empty title → warning toast
- [ ] No questions selected → warning toast
- [ ] Complete flow → success toast: «آزمون جدید با موفقیت ایجاد شد.» (NO alert popup)

## 9. Settings (تنظیمات)

- [ ] Profile card renders with teacher data (single fetch — no flicker)
- [ ] Edit name/school → save updates everywhere (sidebar, topbar, settings)
- [ ] Runtime mode badge visible

## 10. Global visual checks

### Glass system
- [ ] Cards are translucent — content behind slightly visible on scroll
- [ ] NO solid white `bg-white` panels with hard edges (modals/sections)
- [ ] Consistent corner radius: no mixed rounded-2xl/rounded-3xl on same-level elements
- [ ] Shadows subtle, not heavy

### RTL correctness (critical)
- [ ] Sidebar on the RIGHT side
- [ ] Text right-aligned everywhere
- [ ] Icons in logical position (left of text where appropriate)
- [ ] No clipped Persian text or reversed layout in modals
- [ ] TheMark logo row is NOT mirrored (gold circle should be 3rd from the right edge of the row → i.e., visually 3rd bubble from the row's start going left-to-right in RTL context — verify it matches the spec SVG)

### Typography & color
- [ ] Font is Vazirmatn throughout
- [ ] Persian digits everywhere numbers are shown
- [ ] Only indigo/emerald/amber/red accents — no stray violet/teal/blue-green
- [ ] Gold appears ONLY in: sidebar active bar, TheMark, hero glow — nowhere else unexpected

### Motion
- [ ] Gold pop animation on TheMark (once, springy)
- [ ] Sidebar active pill slides between items
- [ ] Modal/drawer open/close animations smooth
- [ ] With OS "reduce motion" enabled: animations gone, everything still functional

### Responsive breakpoints
- [ ] 375px (iPhone SE): nothing overflows, sidebar hamburger works, cards stack
- [ ] 768px (tablet): stats grid 2-col
- [ ] 1024px+: full layout, sidebar fixed

### Accessibility (keyboard)
- [ ] Tab through sidebar: focus outline visible (indigo ring)
- [ ] Tab through buttons: visible focus ring everywhere
- [ ] Enter activates focused items
- [ ] Modal: can close with the X button reachable by keyboard
- [ ] Toast appears in the tab order reasonably / can be dismissed

## 11. Regressions / crashes

- [ ] No console errors on: Dashboard / Students / Classes / Questions / Exams / Settings (open DevTools)
- [ ] Switch role («بخش دانش‌آموزی») still navigates to student simulator
- [ ] Logout works
- [ ] Direct URL navigation works (paste URL, page loads)
- [ ] Page refresh on any tab doesn't crash

---

## Bug log

| # | Where | What happened | Expected | Severity (low/med/high) |
|---|-------|---------------|----------|------------------------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |

## Notes

-
