# Visual guard rails

**Phase 0 of the agreed plan.** Written so that no later phase can quietly undo
work that is already correct. See `docs/brand-the-mark.md` for brand colour and
the ULTIMATE plan's §0 amendments for the roadmap (7 phases, not 9).

## Do not break

| # | Thing | Why it is at risk | How it is verified |
|---|---|---|---|
| 1 | **Popup/halo origin animation** (`useOriginFromTrigger`) | The glass cleanup (Phase 2–3) rewrites the halo layer this animation measures its origin from | `git diff` on the hook; it must stay byte-identical unless the halo change is re-verified in the same commit |
| 2 | **Halos stay static** | Animating `opacity` on a `backdrop-filter` element kills its blur mid-animation | No `transition`/`animation` on opacity for any backdrop-filter element |
| 3 | **`api/`, Supabase migrations, `.env.local`, deploy config** | Visual passes must never reach the backend | `git status` before every commit — these paths never appear |
| 4 | **RTL and Persian behaviour** | Layout refactors read as "visual polish" and quietly break direction | `npm run check` (includes a11y + direction assertions) |
| 5 | **Tests green at the end of every phase** | The plan only asks for comparison at release, which is too late | `npm run test` — 82 tests |
| 6 | **`npm run check` green at the end of every phase** | Same | typecheck → lint → theme → a11y-buttons → build |

## The gates

```bash
npm run check            # typecheck + lint + theme tokens + a11y + build
npm run test             # vitest, 82 tests
npm run check:theme      # colour must go through --color-* tokens
npm run check:typography # text-* utilities that emit no CSS (see debt below)
npm run format:check     # prettier
```

`check:typography` is **report-only** (exit 0) on purpose. It is wired to fail
only after the debt below is cleared, so it can move into `check` in Phase 1.

## Known debt — Phase 1

`text-md` is never declared in `src/index.css`, so it emits **no CSS at all**:
the class looks applied and silently isn't. Confirmed absent from
`dist/assets/*.css`.

| Site | Form |
|---|---|
| `src/components/UIComponents.tsx:74` | `md:text-md` |
| `src/components/UIComponents.tsx:646` | `md:text-md` |
| `src/components/UIComponents.tsx:740` | `text-md` |
| `src/components/UIComponents.tsx:822` | `md:text-md` |
| `src/pages/student/ExamPortal.tsx:604` | `text-md` |
| `src/pages/student/ExamPortal.tsx:818` | `text-md` |
| `src/pages/teacher/ExamPreview.tsx:611` | `md:text-md` |
| `src/pages/teacher/ExamResults.tsx:601` | `text-md` |
| `src/pages/teacher/ExamResults.tsx:1153` | `text-md` |
| `src/pages/teacher/ExamResults.tsx:1247` | `text-box` |
| `src/pages/teacher/ExamSettings.tsx:419` | `md:text-md` |
| `src/pages/teacher/Exams.tsx:206` | `text-md` |
| `src/pages/teacher/Questions.tsx:741` | `text-md` |
| `src/pages/teacher/Students.tsx:464` | `text-md` |

Replace each with a declared role — `text-display`, `text-heading-1`,
`text-heading-2`, `text-heading-3`, `text-body`, `text-label`, `text-caption`,
`text-micro`. Because the class currently renders nothing, fixing it is a
**visible** change: `md:text-md` buttons will start scaling at `md`. Review
screenshot-by-screenshot.

## The material laboratory

`src/pages/dev/FixtureGallery.tsx` renders every shared primitive with no
Supabase, no session and no network. It is the fixture any visual change is
judged against.

- 5 material recipes — `glx`, `glx-strong`, `glx-dark`, `glx-inset`, `glx-clear`
- Full type scale, elevation ladder (`elevation-0` … `elevation-4`), controls,
  states (modal / empty / loading / error), saturated test backdrop
- Theme toggle covers light/dark/system
- Covered by `src/test/pages/FixtureGallery.test.tsx` (3 tests), so a
  regression that breaks rendering fails `npm run test` rather than reaching
  review.

**No screenshot baselines.** Agreed: the fixture plus typecheck/build/DOM checks
is the verification loop, and the user confirms visuals. Do not reintroduce a
local-server check — the app runs on Vercel only.
