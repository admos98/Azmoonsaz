# Task List — Azmoon Visual Polish Pass

## Status: Active (do not stop until all done)

## Tasks

### 1. Fix menu closing animation — panels suck back into hamburger button
- **Problem**: Hamburger panels use `dropOut` (translate down + fade). User wants them to scale/shrink back INTO the hamburger button origin (like the notification bell pattern).
- **Fix**: Added `shrinkToHamburger` + `growFromHamburger` keyframes in `index.css`, computed `transformOrigin` from hamburger button Rect, applied to all 4 panels during close.
- **File**: `src/components/Topbar.tsx`, `src/index.css`
- **Status**: ✅ DONE (committed local, not pushed)

### 2. Fix shallow/flat panels — replace `bg-white/3` and `bg-white/4` with proper `glx*` classes
Replaced ~300 instances of hardcoded `bg-white/3`, `bg-white/4`, `bg-white/3/70`, `bg-white/4/60` that bypass the 4-layer lens stack across all teacher pages and shared components.

**Files modified**:
- ✅ `src/components/UIComponents.tsx` — Button, Badge, Input, Select, Tabs, Modal, EmptyState, Dropzone, Table
- ✅ `src/components/QuestionRenderer.tsx` — question option containers, pair inputs
- ✅ `src/pages/teacher/Dashboard.tsx` — hero card, stat cards, exam rows, modals
- ✅ `src/pages/teacher/Students.tsx` — student table, form modals
- ✅ `src/pages/teacher/Classes.tsx` — class cards, forms
- ✅ `src/pages/teacher/Questions.tsx` — question cards, category panels
- ✅ `src/pages/teacher/Exams.tsx` — exam rows
- ✅ `src/pages/teacher/ExamResults.tsx` — results table, filter panels
- ✅ `src/pages/teacher/ExamSettings.tsx` — settings panels
- ✅ `src/pages/teacher/NewExam.tsx` — form fields
- ✅ `src/pages/teacher/ExamPreview.tsx` — preview cards, modals
- **Status**: ✅ DONE (committed local, not pushed)

### 3. Verify all changes
- [x] `npm run typecheck` — passed
- [x] `npm run build` — passed (5.99s)
- [ ] git push to Vercel — awaiting user approval

### 4. Remaining issues
- **Topbar separation**: Removed `glx` from `#router-view-box` in App.tsx, replaced with `bg-transparent`. Need user to verify this fixed the line-under-topbar.
- **Standalone `bg-white` panels** in ExamPreview.tsx still need conversion to `glx` (86 remaining instances).
- Student-facing pages (`ExamPortal.tsx`, `SecureExamPortal.tsx`) not touched per exclusion.

## Next steps
1. Wait for user to verify the border/topbar fix on deployed URL
2. If confirmed, push the commit
3. Fix remaining standalone `bg-white` panels in ExamPreview.tsx
4. Address any new bugs the user finds
