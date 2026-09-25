# Visual primitive inventory

**Phase 0 §3.2.** Measured from the tree on 2026-09-26 — counts are actual
regex matches over source, not estimates. Companion to
`docs/visual-guard-rails.md`.

## 1. What the system defines

`src/index.css` declares **17 `@utility` blocks** — everything else visual comes
from Tailwind defaults or arbitrary values.

| Group | Utilities |
|---|---|
| **Glass (9)** | `glx`, `glx-strong`, `glx-dark`, `glx-inset`, `glx-clear`, `bgfx`, `veil-blur`, `area-blur`, `scrim` |
| **Type (8)** | `text-display`, `text-heading-1`, `text-heading-2`, `text-heading-3`, `text-body`, `text-label`, `text-caption`, `text-micro` |

- **41 `--glass-*` variables** control the material: body (`p-a1/p-a2/p-angle/p-blur/p-radius/p-tint…`), halo (`h-blur/h-fill/h-bright/h-tint/h-ratio…`), specular (`shn-t/shn-b`), shadow (`sh-x/sh-y/sh-blur/sh-color…`), scrim, veil, and the page-level `bg-bright/bg-blur/bg-sat` trio.
- **6 keyframes**: `mark-pop`, `growFromBell`, `shrinkToBell`, `growFromHamburger`, `shrinkToHamburger`, `shimmer`.
- **11 `backdrop-filter` sites** in CSS.
- **1 `<GlassSheen>` site** — `App.tsx`, wrapping the routed page. This is the page-wide sheen the plan wants moved onto floating surfaces only.
- ~~`src/theme/{tokens,colors,glass,typography}.ts`~~ **deleted in Phase 1** — see §4. `index.css` is now the only place visual values are declared; there is no second file left to drift.

## 2. Measured usage (all of `src/**.tsx`)

### Material — one recipe dominates

| Recipe | Uses | Share |
|---|---:|---:|
| `glx` | 269 | 68% |
| `glx-inset` | 88 | 22% |
| `glx-strong` | 28 | 7% |
| `glx-dark` | 6 | 1.5% |
| `glx-clear` | 3 | 0.8% |
| **Total** | **394** | |

Confirms the plan's "one dominant surface per region" diagnosis: a base card and
a modal-adjacent panel draw from the same recipe 68% of the time, while the
strongest recipe is used 28 times.

### Radius — 9 distinct values, no scale

| Radius | Uses |
|---|---:|
| `rounded-xl` | 270 |
| `rounded-2xl` | 151 |
| `rounded-lg` | 103 |
| `rounded-full` | 89 |
| `rounded-md` | 80 |
| `rounded-3xl` | 63 |
| `rounded-t-3xl` / `rounded-[14px]` / `rounded-r-full` | 4 |
| **Total** | **764** |

Top two values carry 55% of all radii. No elevation/role correlation — a
dropdown, a card and a page panel can share `rounded-2xl`.

### Shadow — 9 distinct values

`shadow-sm` 27, `shadow-xs` 27, `shadow-3xs` 15, `shadow-md` 15, `shadow-lg` 11,
`shadow-2xl` 6, `shadow-2xs` 4, `shadow-inner` 4, plus 3 arbitrary
`shadow-[var(--color-success)]`. **119 total.**

### Typography — heavily skewed toward tiny text

| Role | Uses |
|---|---:|
| `text-micro` | 468 |
| `text-caption` | 399 |
| `text-label` | 114 |
| `text-heading-1` | 17 |
| `text-heading-3` | 20 |
| `text-heading-2` | 13 |
| `text-body` | 15 |
| `text-display` | 1 |
| **Total** | **1047** |

**`text-micro` + `text-caption` = 83% of all typed text.** The plan's rule
"never use tiny text to create false sophistication" is still violated by
default. `text-body` — the reading role — is used 15 times.

*(Phase 1 re-measured these: `text-md` was cleared, so `text-heading-3` went
15 → 20 and `text-body` 7 → 15, total 1034 → 1047.)*

## 3. Where the material actually lives

Plan §3.2 names 10 component/theme files for inventory. Measured across those
10:

| File | glx | radii | shadows | type roles | lines |
|---|---:|---:|---:|---:|---:|
| `components/UIComponents.tsx` | 24 | 27 | 7 | 44 | 1241 |
| `components/Topbar.tsx` | 9 | 23 | 4 | 24 | 895 |
| `components/Sidebar.tsx` | 3 | 9 | 1 | 9 | 266 |
| `components/GlassSystem.tsx` | 3 | 0 | 0 | 0 | 103 |
| `components/CommandPalette.tsx` | 1 | 6 | 2 | 7 | 364 |
| `components/TheMark.tsx` | 0 | 0 | 0 | 0 | 172 |
| ~~`theme/*.ts`~~ deleted in Phase 1 | — | — | — | — | — |
| **10 named files** | **40** | **65** | **14** | **85** | |

**The named files hold 10% of the material usage.** The other ~354 `glx` uses
and ~699 radii sit in `src/pages/**`, which §3.2 does not list. Any Phase 3
material-hierarchy pass must inventory the pages, or it re-skins the shared
primitives and leaves most screens untouched.

## 4. Findings → phase mapping

| Finding | Phase |
|---|---|
| `text-md` / `text-box` emit no CSS (14 sites, listed in guard rails) | 1 |
| 84% of text is micro/caption; `text-body` nearly unused | 1 |
| `bgfx` + `veil-blur` + `area-blur` + `scrim` stacked = four layers doing one job | 2 |
| `--glass-p-a1/a2 = 0` (no body), `--glass-shn-t = 0.68` (hard specular) | 2 |
| 9 radii / 9 shadows with no role mapping; `glx` at 68% | 3 |
| Single `<GlassSheen>` wrapping the routed page | 2 |
| Material concentrated in pages, not shared components | 3 and 5 |
| 41 `--glass-*` vars duplicated against `src/theme/glass.ts` — **resolved**: `src/theme/` deleted in Phase 1 | 1 ✓ |
