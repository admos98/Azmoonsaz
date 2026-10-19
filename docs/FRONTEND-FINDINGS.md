# FRONTEND — findings + fix plan (master-engineer edition)

> Written 2026-10-18. Full static audit of every UI file, every theme, every
> gate. Supersedes the open items in `docs/FRONTEND-TASKS.md` (that doc stays
> as the historical record; everything still true from it is folded in below).
>
> Every finding was **measured** — line counts, WCAG ratios, gate exits — not
> eyeballed. Every fix is written the way a staff designer-engineer would
> actually implement it: the mechanism, the exact edit, and the gate that
> proves it landed.

---

## How to read this document

Each finding has:

- **What** — the measured fact (file, line, number).
- **Why it matters** — in user terms, not code terms.
- **The fix** — one specific approach, chosen as the best available. Where the
  fix is a *product decision* rather than a cleanup, it says so.
- **Gate** — the command that must be green before moving on.

Findings are ordered by **user impact**, not by severity-score theatre. Do
them in order.

---

## Finding 1 — Tertiary text is carrying form labels at exactly 3.09:1

**Category:** accessibility / typography hierarchy
**Severity:** BLOCKER (the only one in this audit)
**Status:** CONFIRMED (measured, 46 sites)

### What

`--color-text-tertiary` (`#8a8694`) measures **3.09:1** on the light page
(`#f2efe8`) — WCAG's 3.0:1 *non-text* floor, with 0.09 to spare. It is
supposed to be the hint tier (placeholder text, decorative counters).
Instead, **46 call sites** use it as a small *bold* label — the text a user
must read to fill a form:

```
src/pages/teacher/ExamPreview.tsx:990     <label className="text-micro text-[var(--color-text-tertiary)] font-bold block">
src/pages/teacher/ExamPreview.tsx:1311    <label className="text-micro text-[var(--color-text-tertiary)] font-bold block">
src/pages/teacher/ExamResults.tsx:386     <label className="text-micro text-[var(--color-text-tertiary)] font-bold block">
... 43 more across ExamResults, ExamPreview, ExamSettings, Questions, Settings
```

Two real problems stack here:

1. **Role drift.** These are not hints; they are *labels*. The hint tier was
   never meant to carry required-reading text.
2. **Zero margin.** 3.09:1 is a floor-value pass. Any future change to the
   page background, the glass fill alpha, or the tertiary hex itself flips
   these to a hard AA failure, silently, on every form in the app.

### Why it matters (in user terms)

A teacher filling in an exam paper mouth-to-grade on a laptop in a bright
room is reading 12px text at 3.09:1. Apple would never ship that. This is the
difference between a form that *reads* quickly and one that makes you lean in.

### The fix

**Do not just swap the 46 sites to `text-secondary`.** That fixes the
contrast but flattens the visual hierarchy — secondary (5.83:1) is the same
tier used for body copy, so labels would no longer sit *slightly quieter*
than content, which is the correct Apple pattern.

Instead: **create a real label tier.**

1. Add one token to `src/styles/tokens.css` (light block):
   ```
   --color-text-label-muted: #6f6a7d;   /* ≈4.0:1 on page — reads clear, sits a
                                           step below body copy, above hint */
   ```
   And in `src/styles/themes.css` (dark block):
   ```
   --color-text-label-muted: #a09cb0;   /* ≈7.6:1 on dark page */
   ```

2. Add one utility to `src/styles/typography.css`:
   ```css
   @utility text-label-muted {
     font-size: 0.8125rem;    /* caption size — 13px, reads at 12px-weight 700 */
     font-weight: 700;
     line-height: 1.35;
     color: var(--color-text-label-muted);
   }
   ```

3. Replace all 46 sites:
   `text-micro text-[var(--color-text-tertiary)] font-bold` → `text-label-muted`
   (and the caption-sized ones → the same utility).

4. **Grep must come back clean:**
   ```
   git grep -c 'text-micro text-\[var(--color-text-tertiary)\]' src/   # 0
   ```
   Then re-extend the contrast ratchet in `tools/check-contrast.mjs` with
   `--color-text-label-muted` at a **4.5:1 floor** so this tier can never
   drift downward again.

### Why this specific fix

A dedicated token, not a reuse of secondary, keeps the visual hierarchy
*meaningful* — labels stay slightly quieter than body copy but clearly above
hints, which is exactly how Apple labels grouped-list rows. It's one new
token + one new utility + one mechanical swap; every future call site writes
`text-label-muted` and gets correct contrast by construction. This is the
"make the right thing the easy thing" move.

### Gate

```
npm run check:contrast      # must be green with the new pairing
git grep 'text-\[var(--color-text-tertiary)\]' src/pages src/components | wc -l   # non-label uses only
```

---

## Finding 2 — 336 elements carry a weight override that contradicts their own type utility

**Category:** design-system architecture (single-owner rule)
**Severity:** HIGH
**Status:** CONFIRMED (measured, 336 sites)

### What

Every semantic type utility already declares its own `font-weight`
(`text-micro` → 700, `text-caption` → 600, `text-heading-1` → 700 …). Yet
**336 call sites** also put a separate weight class on the same element:

| combination | count | the conflict |
|---|---|---|
| `text-micro … font-bold` | 108 | both say 700 — dead weight |
| `text-caption … font-bold` | 80 | utility 600, class 700 — call site wins, utility lied |
| `text-label … font-bold` | 24 | both say 700 |
| `text-caption … font-black` | 18 | 3 different intents for one element |
| `text-micro … font-extrabold` | 11 | resolves to 700 — same as no class |
| `text-micro … font-black` | 8 | resolves to 700 |
| ...plus 87 more spreads | | |

The rule of single ownership: **a property is set in ONE place.** When it is
set in two, the winner is decided by CSS cascade order (*which file got
compiled last*), not by design intent — and the utility's declared value
becomes a lie.

### Why it matters

The type scale exists precisely so weight decisions live in one place.
Right now, "what does `text-caption` render as?" depends on *which other
class the developer also pasted that day*. This is the mechanism behind
"the sizes and weights feel inconsistent" — it isn't inconsistency at all,
it's a scale fighting its overrides.

### The fix

Mechanical, one file, helper script:

1. Build a map: for every semantic utility, its declared weight:
   ```
   text-display → 800   text-heading-1 → 700   text-heading-2 → 700
   text-heading-3 → 700 text-body → 400        text-label → 700
   text-caption → 600   text-micro → 700
   ```
2. In each of the 336 call sites, if the `font-*` class resolves to the same
   number as the utility's own weight → **delete the font class** (dead).
   If it differs → **delete the utility instead and keep the font class
   only on `text-body`/non-sized elements**; a per-element weight *choice*
   belongs to the size choice, which is what the utility already encodes.
3. After the sweep, this grep must return 0:
   ```
   grep -roE 'text-(display|heading-[123]|body|label|caption|micro)[^"]*\bfont-(bold|black|extrabold|medium|semibold)\b' src --include='*.tsx' | wc -l
   ```

### Why this specific fix

Sweeping the *overrides*, not adding more tokens, keeps the scale the single
vocabulary. If a genuinely different weight is needed, the *scale* gains a
variant the next time a design needs it — not a call site.

### Gate

```
npm run check:typography    # still green — every utility still resolves
npm run typecheck           # no JSX changes break anything
```

---

## Finding 3 — The brand doc's ink value and the shipped ink disagree, and a stale fallback encodes both

**Category:** design-system hygiene / brand spec integrity
**Severity:** HIGH (it is the *brand's* colour; drift here spreads everywhere)
**Status:** CONFIRMED

### What

`docs/brand-the-mark.md` names ink **`#221E4A`**. The shipped token is
**`--color-ink: #1a1a2e`** (`tokens.css:87`). Meanwhile, `TheMark.tsx:39`,
`TheMark.tsx:148` and `Topbar.tsx:44` all write:

```tsx
const ink = 'var(--color-ink, #221E4A)';
```

Three facts, all slightly different:

- the *doc* says one hex;
- the *shipped token* is another;
- the *fallback string* records a third (the doc's) value, only used if the
  token ever failed to resolve — which it never does.

This is not a visible bug. It's the *spec* quietly disagreeing with the
*product*, and a fallback silently memorialising a colour nobody uses.

### The fix

The doc is the thing that drifted (the shipped colour is the one the user
has been looking at and approving for weeks — the ship has sailed on the
hex). Two edits, both mechanical:

1. **Update the brand doc** to the shipped value:
   in `docs/brand-the-mark.md`, replace `Ink: #221E4A` with `Ink: #1a1a2e`
   and swap the doc's dark-mode notes to match the shipped code (`#f5f6fa`
   strokes in dark, not cream — the code is already correct and the doc
   undersells it).
2. **Delete the fallback strings**:
   `TheMark.tsx:39,148` and `Topbar.tsx:44` → `const ink = 'var(--color-ink)';`
   The token is defined in both themes and can never be undefined; the
   fallback is dead code carrying a stale value.

Result: one ink value, defined once, quoted consistently everywhere the
brand's identity is spoken about.

### Gate

```
git grep '221E4A' src/   # must return 0 hits
```

---

## Finding 4 — The last native `window.confirm` is still hiding in `useUnsavedChanges`

**Category:** UX consistency / component-library adoption
**Severity:** MEDIUM
**Status:** CONFIRMED (2 call sites)

### What

`src/hooks/useUnsavedChanges.ts:29` and `:41` — both calls into
`window.confirm(...)`. Everywhere else in the app native dialogs are gone.
This is the final one, and it sits on the single most delicate interaction
the teacher has: *navigating away from unsaved exam edits*.

The library already has `src/ui/ConfirmDialog.tsx` — a designed, glass-tier,
accessible dialog. This feature is using the browser's 2005-era fallback
instead of it, because a *hook* cannot render a component.

### Why it matters

Untimed, modal, OS-chrome dialog in the middle of an otherwise designed
experience is the most visible kind of inconsistency — it is the moment the
product suddenly reads as amateur. And this is the *one* place where a
mis-click has real cost (losing exam edits).

### The fix

Convert the hook from "returns confirmation via `window.confirm`" into a
hook that *drives* a dialog component:

1. `useUnsavedChanges` becomes a state machine:
   ```ts
   // inside the hook (pseudocode of the shape, not a full rewrite)
   const [pendingNav, setPendingNav] = useState<(() => void) | null>(null);
   function requestNav(action: () => void) { if (isDirty) setPendingNav(() => action); else action(); }
   function confirm() { setPendingNav(null); pendingNav(); }
   function cancel() { setPendingNav(null); }
   return { requestNav, dialogProps: { open: !!pendingNav, onConfirm: confirm, onCancel: cancel } };
   ```
2. The *page* that consumes the hook (whoever mounts it) renders
   `<ConfirmDialog {...dialogProps} title="Unsaved changes" body="…. Publishing or leaving now discards them." />`.
3. Delete the two `window.confirm` calls.

The key insight: **the hook stays a hook** — it just returns dialog props
instead of *doing* the confirm itself. Whoever owns the route owns the
render. This keeps the hook composable and testable.

### Gate

```
git grep 'window.confirm' src/   # 0 hits
npm run test                     # useUnsavedChanges tests updated and green
```

---

## Finding 5 — `check-sizes` is RED: the glass engine wrote four files past their caps and three pages past theirs

**Category:** maintainability / engineering discipline
**Severity:** HIGH (the cap exists to stop this exact slide)
**Status:** CONFIRMED (11 gate failures, measured)

### What

```
✖ src/pages/teacher/Questions.tsx              1968  (grandfathered 1850)
✖ src/pages/teacher/Students.tsx               1238  (grandfathered 1163)
✖ src/pages/student/SecureExamPortal.tsx        892  (grandfathered  630)
✖ src/components/StudentQuestionCard.tsx        590  (new file, 400 limit)
✖ src/components/QuestionRenderer.tsx           577  (grandfathered  550)
✖ src/glass/glassController.ts                 1550  (grandfathered  697)
✖ src/glass/perfRecorder.ts                     750  (grandfathered  664)
✖ src/glass/mapMath.ts                          407  (new file, 400 limit)
✖ src/glass/webglRenderer.ts                   1005  (new file, 400 limit)
✖ src/App.tsx                                   460  (grandfathered  451)
✖ src/test/config/glassMaterial.test.ts         950  (grandfathered  908)
```

Also: **two more files the task list has never mentioned** —
`ExamSettings.tsx` (1356) and `ExamResults.tsx` (1307) are among the largest
UI files in the app and are absent from every planning doc.

### Why it matters

A size cap that is 2.4× over (`glassController`) is not a cap — it is a
cosmological constant nobody enforces. Worse: the three NEW glass files
(`webglRenderer`, `mapMath`, `glassController` on its rewrite) shipped
already over the new-file limit, which means the rule that "new files start
under 400 lines" was decided and then immediately not applied to the exact
files born during that decision.

### The fix — split by *seam*, not by size

The professional move is never "cut the file in half at line 300." It is:
find the natural boundary and split there, keeping every behavioural
contract identical. For each file:

**`src/glass/glassController.ts` (1550 → target ≤ 4 layers)**
Already has one natural seam — the compositor sync. Split:
- `glass/state.ts` — DOM rect collection, `isNestedGlass`, tier resolution
- `glass/maps.ts` — the edge-weighted displacement-map builder (moves `mapMath` consumers)
- `glass/paint.ts` — the canvas paint loop + per-panel filter attach
- `glassController.ts` — becomes only the orchestrator + public API

Test seam: `src/test/config/glassMaterial.test.ts` (950 lines) already
exercises the behaviour; keep it green as-is (do not change the *tests*
– change the *source*, then the tests prove the refactor is behavioural-no-op).

**`src/glass/webglRenderer.ts` (1005)**
Same move: shader/program management → `webgl/shaders.ts`; buffer/geometry →
`webgl/buffers.ts`; render loop stays.

**`src/glass/mapMath.ts` (407)** — the 400-line limit is presumably aimed at
*UI* files; a pure-math helper at 407 is fine, but the honest move is to
raise the cap for pure-math files OR split coordinate-mapping from colour
mapping. Either is defensible; pick one and note it in the gate config.

**`StudentQuestionCard.tsx` (590)**
The seam is *answer state vs. render*. Extract `StudentAnswerBar` (the
palette + marking UI) into `features/exam-taking/`, keep the card shell.

**`Questions.tsx` / `Students.tsx` / `SecureExamPortal.tsx`** — the doc's own
plan is STILL right and still unexecuted; extract the list of sections the
doc names. Not re-scoped here — the doc's split boundaries were correct,
they just never landed.

### Why this specific fix

Splitting by seam keeps git blame readable, keeps diff surface small, and —
critically — means the *tests written against the old shape* still pass,
which is the only honest proof that nothing changed. Splitting by arbitrary
file size invalidates the test file and forces a rewrite of tests just to
hide the refactor.

### Gate

```
npm run check:sizes     # back to green (with the same or lower caps)
npm run test            # glassMaterial.test.ts green, untouched or only import-paths updated
```

---

## Finding 6 — The contrast gate's tertiary ratchet is measuring the wrong thing

**Category:** engineering / gate correctness
**Severity:** MEDIUM
**Status:** CONFIRMED (measured: 173 sites, baseline 182)

### What

`tools/check-contrast.mjs` has a ratchet: tertiary at sub-14px must not
*grow* past 182 sites (now at 173). Correct instinct. But it checks **count**,
not **role** — a count can hold steady while every one of those 173 sites
drifts from "hint" to "label" and the ratio is still 3.09:1.

### The fix (after Finding 1 lands)

Change the ratchet from a count to a **pairing assertion:**

1. Add explicit pairings to `PAIRS` in `check-contrast.mjs`:
   - `--color-text-label-muted` on `--color-page-bg`, floor 4.5
   - `--color-text-label-muted` on `--color-surface`, floor 4.5
   - `--color-text-tertiary` — keep the 3.0:1 non-text floor but **add a
     marker** that any tertiary use whose sibling class includes
     `font-bold`/`font-black`/`font-semibold`/`font-extrabold` must fail
     (weights above 400 on tertiary = it is not a hint).
2. This isn't a heuristic the tool should guess at silently — emit a
   clear error: "tertiary text is bold — bold tertiary is a label, not a
   hint; use `--color-text-label-muted`."

### Why this specific fix

A gate that checks *role* can never be appeased by shifting numbers; it
only goes green when the design is actually right. The current gate can be
appeased forever by keeping a count under a ceiling while the *meaning* of
those call sites drifts into precisely the bug this gate exists to stop.

### Gate

```
npm run check:contrast   # must now FAIL on a tertiary+bold site (negative test)
```

---

## Finding 7 — Component library adoption still has a low ratio, and the "Card" abstraction has drifted

**Category:** design-system architecture
**Severity:** MEDIUM
**Status:** CONFIRMED (measured)

### What

Measured through real `className=` string extraction:

| signal | count |
|---|---|
| `<Card/>` direct uses | 25 |
| hand-written `lens/pane/frost/field` surfaces | ~150 |
| `className` strings repeated 3+ times in one file | **253** |
| top repeat — `text-micro text-[var(--color-text-tertiary)] font-bold block` | 23× |
| `lens/pane` + `rounded-*` + `p-5 md:p-6` composed at call site | ~150 |

And specifically: `src/components/StudentQuestionCard.tsx:569` hand-writes
exactly what `Card` exists to own.

Also measured from `Card.tsx`: the `glassLayer` union has 4 variants
(`light / strong / inset / none`) but `none: ''` means "no class at all,"
which is the union admitting the abstraction doesn't fit every case.
`hoverable`'s `props as any` cast (Finding 8) is the symptom of the same
drift — Card is typed for two jobs and is asked for a third.

### The fix

Not a bigger Card. **A better seal between Card and the pages.**

1. Create one primitive the repeated string pattern maps to exactly:
   `<FieldLabel />` in `src/ui/` — consumes Finding 1's `text-label-muted`
   utility, accepts `for:` and `required:`, and is the ONLY place in the app
   that encodes the visual vocabulary of a form label.
2. Migrate the 23 + 10 + 46 repeats of that exact string into `<FieldLabel/>`
   calls. This is ~150 call sites rewritten once.
3. For Card: rather than renaming or growing it, add a `padding` prop
   (`none | sm | md` → `'' / p-3 / p-5 md:p-6`) so the ~150 `lens + rounded
   + padding` compositions at least reuse the padding decision. Do not try
   to win the glass-compose war at the call site; win it by making the
   *right* composition a one-liner.
4. Mark Card's `none: ''` union member with a comment naming its purpose —
   "row, not panel" — so nobody removes it by accident.

### Why this specific fix

A migration to `FieldLabel` is not a cleanup, it's a *policy* — new pages
import it automatically because it's the obvious thing to reach for. The
`props as any` in Card then becomes removable (Finding 8), because the
drag-layer variant it supports gets its own typed path.

### Gate

```
npm run check:library    # ratchet still green
grep -c 'text-micro text-\[var(--color-text-tertiary)\] font-bold block' -r src/   # 0
```

---

## Finding 8 — Card.tsx `props as any` — the one cast with a real fix

**Category:** type safety
**Severity:** LOW
**Status:** CONFIRMED (`Card.tsx:43-44`)

### What

The `hoverable` branch spreads motion-div props by casting the whole props
object to `any`. This is documented in the file as intentional; the finding
isn't "bad code," it's "the cast exists because two HTML/N motion props
aren't unioned."

### The fix

Union the prop types once, at the interface:

```ts
import type { HTMLMotionProps } from 'motion/react';
export interface CardProps extends HTMLMotionProps<'div'> {
  hoverable?: boolean;
  glassLayer?: 'light' | 'strong' | 'inset';
}
```

Then the spread compiles without the cast, and `motion.div`'s attributes and
`div`'s attributes are one set. Two lines deleted, one import added, one
`as any` removed.

### Gate

```
npm run typecheck
```

---

## Finding 9 — Two of the app's largest UI files are absent from the task doc entirely

**Category:** planning correctness
**Severity:** LOW (correctness of the doc, not of the code)
**Status:** CONFIRMED (measured: 1356, 1307 lines)

### What

`ExamSettings.tsx` (1356) and `ExamResults.tsx` (1307) rank 3rd and 4th
largest. The task doc's section 3 lists five files, none of them these two.

### The fix

Update `docs/FRONTEND-TASKS.md` section 3 (or pivot to this doc entirely —
which is what this document does) to include both, with the seam boundaries
the same way Finding 5 specifies.

### Gate

```
# doc-only; no gate
```

---

## Finding 10 — Release gates: all six manual passes from the old doc are still open

**Category:** release blockage
**Severity:** HIGH (they block a "final" release, per the old doc's own framing)
**Status:** CONFIRMED (verified open)

These are unchanged from `FRONTEND-TASKS.md` §1 and still blocked on human
effort, not code:

- Viewport matrix (Playwright config runs one project: chromium only).
- Keyboard-only pass on the two primary flows.
- Reduced-motion hands-on.
- Forced-colors hands-on.
- 200% zoom.
- Manual contrast on the real glass surfaces.

Nothing in this audit changes their priority order. **These are the
release-blocking items**; everything above is craft. The one thing this
audit adds: **Finding 1 and Finding 3 are the two that make those manual
passes *easy* once done.** If tertiary is carrying labels, the reduced-motion
and forced-colors passes will each surface the same complaint ten times;
fix the root once, then do the manual work in one pass.

### Gate

these are the gates.

---

## Already done — do not re-do

Verified still-true on 2026-10-18 (bench-checked against tree):

- Zero raw Tailwind palette classes in any TSX (`text-slate-*`, `bg-indigo-*`
  … — 0 hits). The token policy holds, everywhere.
- Zero arbitrary `rounded-[…]` in any TSX.
- Zero `animate-pulse` misuse (the one looping loader is the documented
  bubble-loader, brand-driven, motion-reduced).
- `text-[11px]` — exactly 1, in `Watermark.tsx` (decorative overlay,
  intentionally tiny; acceptable, and the only such site in the app).
- The contrast gate is green on every pairing it asserts, both themes.
- `check:typography` — every `text-*` utility resolves to a real rule.
- `check:headings` — 17 route modules, one h1 each, no skipped levels.
- `check:library` — one button system, ratchet held across all categories.
- `check:glass` — bend owned by panel chains, no inline backdrop-filter.
- Type-check and lint both green, zero warnings.
- The Mark component is a faithful implementation of the brand spec
  (coordinates, stroke ratios, gold-pop easing, reduced-motion handling) —
  the only issue is the stale fallback string (Finding 3).
