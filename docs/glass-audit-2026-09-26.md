# Glass audit — why this does not read as liquid glass

Date: 2026-09-26 · Audited at `818e415` · **No code changed.**

Read: `src/index.css` (1329 lines, all glass sections), `src/hooks/useEdgeLight.ts`,
`src/components/GlassSystem.tsx`, and 41 `.glx-strong` / 269 `.glx` call sites.
Evidence: six screenshots (light + dark, dashboard/settings/menu/hero) plus
computed values read from the deployed app via CDP.

---

## 0. The one-sentence version

The panels are not glass because **there is nothing behind them to be glass**,
and because **the only edge cue that survives is a 1px dark border** — which is
precisely the "bad light border" being seen. Every other problem is downstream
of those two facts.

---

## 1. The rim is white on white. It has never been visible.

`src/index.css:194`

```
--glass-edge-color: 255 255 255;      /* the rim */
--glass-p-tint:     255 255 255;      /* the panel it sits on */
```

Composited over the light page (`#faf8f5`):

| | RGB | diff from panel |
|---|---|---|
| panel fill | `251,250,247` | — |
| rim, white @ 0.5 | `253,252,251` | **4 / 255** |
| border, ink @ 0.22 | `202,201,200` | **49 / 255** |

The rim is 12× less visible than the border it was meant to replace. In light
mode you are looking at the border. This is the whole "light border" complaint.

Dark mode works because the rim is white on `36 33 44` — that pairing has real
contrast. `--glass-edge-color` is never themed; dark inherits light's white by
accident rather than by decision.

**Fix:** the rim cannot be brighter than the panel it lights. Either the panel
body must drop in value toward its edges so a white rim has something to sit
against, or the rim must be *warm* light (`255 246 230`) against a *cool* body.
The first is the physical one and is required regardless.

---

## 2. "Size-relative thickness" is a fiction

`src/index.css:188-190` — `clamp(1.5px, 4.2%, 3.6px)`

| panel width | 4.2% | clamped |
|---|---|---|
| 40px | 1.7px | 1.68px |
| **86px** | 3.6px | **3.6px — ceiling** |
| 120px | 5.0px | 3.6px |
| 600px | 25.2px | 3.6px |
| 1376px (hero) | 57.8px | 3.6px |

The ceiling is reached at **86px**. Every panel in the app above that width —
which is all of them — gets an identical 3.6px band. The hero and a stat chip
are the same. Dark: ceiling at 84px, same outcome.

**Fix:** the clamp bounds are doing all the work and the percentage is doing
none. Delete the percentage, or widen the ceiling until the percentage is the
binding constraint at realistic panel widths. A hero should carry a visibly
heavier edge than a 120px tile — that is what "relevant to the panel's size"
means.

---

## 3. The rim is architecturally incapable of fading inward

This is the important structural finding.

`src/index.css:491-498` masks the gradient to the padding box:

```css
mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
mask-composite: exclude;
```

A ring has **no interior**. The mask confines every gradient to the 3.6px band
between `border-radius` and the content box. The top band is therefore a single
flat alpha:

| card height | band as % of box | alpha at band bottom |
|---|---|---|
| 40px | 9.0% | 0.457 |
| 247px (hero) | 1.5% | 0.493 |
| 400px | 0.9% | 0.496 |

A `0.5 → 0.46` ramp across the whole panel height is **visually identical to a
constant 0.5**. That is why it reads as a drawn line, not as light: light
falling on glass has a soft profile across the band, and there is no mechanism
here that can produce one.

**Fix:** an inward-fading glow needs a gradient that continues *past* the ring
into the panel body — i.e. an inset shadow or a second layer that is not
masked to the ring. A `box-shadow: inset` with a large blur and low alpha gives
exactly the "light surfacing off the edge and dying a few px in" behaviour. The
ring can stay for the crisp outer 1px, but it cannot be the whole effect.

---

## 4. Panels are ~1% different from the page

| theme | panel | page | max channel diff |
|---|---|---|---|
| light | `251,250,247` | `250,248,245` | **2/255 (0.8%)** |
| dark | `27,25,33` | `24,22,29` | **4/255 (1.6%)** |

The fill is a low-alpha tint (`0.30`/`0.14` light, `0.30`/`0.18` dark) over a
page of almost the same value. The result is a rectangle with no material
presence — "all panels look same colour as the background", exactly as
described.

This is also why dark "feels flat": a dark panel over a dark page has almost no
luminance range to work with, and the current recipe spends none of it.

**Fix:** raise the body separation and, more importantly, make the panel
*darker at the rim and lighter at the centre* (§1). A real pane is densest at
its edge because that is where it is thickest.

---

## 5. There is nothing behind the glass to distort

`src/index.css` body background is two radial tints at **1% opacity** over flat
cream:

```css
radial-gradient(circle at 10% 18%, rgba(26,26,46,0.01), transparent 32%),
radial-gradient(circle at 90% 80%, rgba(245,179,1,0.01), transparent 26%)
background-color: rgb(250,248,245)
```

`backdrop-filter: blur(7px)` on a flat field returns a flat field. There is no
detail behind any panel, so blur, saturation and the refraction filter all have
nothing to act on.

This is the deepest issue and it is not a CSS bug. Apple's liquid glass sits on
wallpaper, icons and app content — there is always structure behind it. A web
app panel sitting on a flat page has no equivalent unless the page provides one.

**Fix (pick one):**
- give the page real depth — a visible gradient field, a subtle texture, or
  content that genuinely scrolls under the panels; or
- accept that in-page cards are *frosted panels* (fill + rim + shadow) and
  reserve true refraction for floating chrome (menus, topbar, modals) which do
  sit over content.

The second is honest and is what the current code half-does.

---

## 6. Three blur layers stack, and the tokens disagree

- `glx` uses `--glass-bg-blur: 7px` with `brightness(0.97) contrast(0.92)` (`:518`)
- `glx-strong` uses `--glass-p-blur: 6px` with `brightness(1.04) contrast(1)` (`:538`)
- beneath both sit `.veil-blur` (4px) and `.area-blur` (5px)

Two different blur recipes for what is meant to be one material, with **opposite
brightness** (0.97 darkening, 1.04 lightening). Stacked, they produce a uniform
matte with no crispness — glass has a sharp surface *and* a soft interior, and
currently it is all soft.

**Fix:** one blur recipe in tokens, shared by both weights. Differentiate
`glx` from `glx-strong` by shadow and fill weight only.

---

## 7. Two competing edge systems, and the border wins

Before `5e61d33` the `* { border-color: transparent }` bug meant the glass
border never rendered. Fixing the layer exposed a new problem: now **both** a
1px dark hairline *and* a white rim draw on every panel, and the hairline is
12× more visible (§1). The rim is decoration on top of a border.

**Fix:** the rim should *be* the edge. Drop `--glass-p-ba` to near zero, or drop
the border entirely and let a properly-weighted rim plus an inner shadow carry
the separation.

---

## 8. The hero is a dark slab in both themes

`src/index.css` `#dashboard-hero-banner` hardcodes

```css
background: linear-gradient(125deg, rgba(26,26,46,0.97), rgba(35,36,62,0.94));
color: white;
```

at 0.97 alpha over a light page — effectively opaque ink. Confirmed on the live
app. The JSX styles hero text with theme tokens (`--color-text-primary`) which
the CSS then overrides to white, so the hero cannot follow the theme without
becoming unreadable. It is a deliberate focal design, not a bug, but it is why
light mode reads as two unrelated materials.

---

## 9. Radius is inconsistent between panel and halo

`--glass-p-radius: 28px` is used only by `area-blur` (`:622`). Panels use
Tailwind's `rounded-2xl` (16px) / `rounded-3xl` (24px). The halo behind a panel
is therefore built on a different radius than the panel it surrounds, which
shows as a misaligned glow at the corners on every modal and dropdown.

**Fix:** one radius token, consumed by both.

---

## 10. Light direction is defined twice, inconsistently

- the fill is a linear gradient at `108deg` (`:507`, `:529`) — top-left to
  bottom-right
- the rim is a vertical gradient, brightest at top (`:485-490`)

Two different light directions on the same object. Real glass has one.

**Fix:** single light source. Radial fill from above, matching the rim.

---

## What "mastercrafted" actually requires

The target behaviour, stated so it can be checked:

1. **Body** — densest at the rim, clearest at the centre. A radial wash, not a
   linear one. This alone fixes light mode and gives dark mode its depth back.
2. **Rim** — three-part, not one: a crisp sub-pixel outer line, a 2–4px band
   that peaks and falls off *across its own width*, and an inset shadow that
   carries the glow a few px into the panel. The middle part is what is missing
   and is not expressible with a masked ring.
3. **Thickness** — actually varies with panel size (§2), or drop the pretence.
4. **No competing border** (§7).
5. **One blur recipe** across weights (§6).
6. **Rim colour themed**, not inherited by accident (§1).
7. **Refraction kept to floating chrome only** — already correct at 13 sites.

## Order of work

1. Body → radial, rim-weighted (§1, §4, §10). *Biggest visible change.*
2. Rim → add the cross-band falloff and inset glow (§3). *Makes it light, not a line.*
3. Rim thickness → real size response (§2).
4. Remove the competing border (§7).
5. Unify blur tokens (§6).
6. Radius token (§9).

Steps 1–3 are what turns "bordered box" into "pane of glass". 4–6 are cleanup.

## Honest limits

- This audit is from source plus computed values plus your screenshots. I cannot
  see the deployed page, so perceptual judgements ("does it look like glass")
  are yours to confirm after each step.
- Refraction (`backdrop-filter: url()`) is Chromium-only; Safari drops the
  declaration. The `@supports` split is correct, so Safari gets frosted glass —
  but the two will never look identical.
- The `scale="0.14"` in `GlassSystem.tsx` was never visually tuned. On a 1376px
  hero that is up to ~96px of displacement. It needs a look.
