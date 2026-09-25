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
npm run test             # vitest, 85 tests
npm run check:theme      # colour must go through --color-* tokens
npm run check:typography # text-* utilities that resolve to no rule (gates `check`)
npm run format:check     # prettier
```

`check:typography` is a hard gate: part of `npm run check`, exits 1 on any
`text-*` utility that emits no CSS.

## Typography debt — cleared in Phase 1

`text-md` was never declared in `src/index.css`, so it emitted **no CSS at all**
— the class looked applied and silently wasn't. Confirmed absent from
`dist/assets/*.css`. 13 real sites; a 14th reported hit,
`ExamResults.tsx:1247`, was the element id `question-text-box`, not a class.

| Site | Was | Now |
|---|---|---|
| `UIComponents.tsx:74` (Button `lg`) | `md:text-md` | `md:text-body` |
| `UIComponents.tsx:646` (card h3) | `md:text-md` | `md:text-body` |
| `UIComponents.tsx:740` (EmptyState h2) | `text-md` | `text-heading-3` |
| `UIComponents.tsx:822` (h4) | `md:text-md` | `md:text-body` |
| `ExamPortal.tsx:604`, `:818` (h1) | `text-md md:text-heading-3` | `text-body md:text-heading-3` |
| `ExamPreview.tsx:611` (h2) | `md:text-md` | `md:text-body` |
| `ExamResults.tsx:601` (h1) | `text-md md:text-heading-3` | `text-body md:text-heading-3` |
| `ExamResults.tsx:1153` (h2) | `text-md` | `text-heading-3` |
| `ExamSettings.tsx:419` (h2) | `md:text-md` | `md:text-body` |
| `Exams.tsx:206`, `Questions.tsx:741`, `Students.tsx:464` (h2) | `text-md` | `text-heading-3` |

Visible by design: those headings were inheriting `0.9375rem` (15px) from
`body`, so an explicit role is a real size change. In the built CSS
`.font-black` and `.font-bold` sort **after** `.text-heading-3` and
`.text-body`, so the explicit weights still win — only size changed. The user
confirms the result visually.

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
