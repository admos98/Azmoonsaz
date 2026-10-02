# Liquid Glass Playground — v3 (byte-faithful kube.io replica)

A standalone test page that reproduces [kube.io's "Liquid Glass in the
Browser"](https://kube.io/blog/liquid-glass-css-svg/) demo **exactly** —
same math, same SVG filter chain, same sliders, same specular rim.
**No app code is changed** — tune the sliders, copy the tokens, send
them back.

**On Vercel:** `https://azmoon-three.vercel.app/playground/`
(scripts are external — the app's CSP forbids inline `script-src`).
**State lives in the URL** — every slider change rewrites `#p=…`;
copy the address bar to share a tuning.

## App panel presets

`App panels → Type A · banner / Type B · menu` seeds the measured app
spec (A: R≈12px, blur ≈3px; B: R≈24px, blur ≈20px; both transparent,
convex squircle bezel). Tune there, then **Copy app tokens** for a
block that maps 1:1 onto `src/index.css` plus the
`--lens-*` physics params.

**Dim Strength (RGB wash)** — per-channel linear wash over mid-grey
(ratios 1 : 1.053 : 1.474): white washes to warm grey, blue keeps its
blue, zero at 0. Defaults: **0.15 light mode, 0.05-0.08 dark mode**.
Maps to `--lens-dim` in the app, where — like here — it runs INSIDE the
filter. App rule: this playground and the live app are identical chains
(the material family `#lens`/`#lens-dark`, `#pane`/`#pane-dark`,
`#drop` in `index.html`; maps from `tools/gen-glass-maps.py`).

## Run it locally

Open `index.html` in **Chrome / Edge / any Chromium** (SVG filters as
`backdrop-filter` are Chromium-only, exactly as the article states).
If the plate image doesn't load from `file://`, serve it:

```bash
cd liquid-glass-playground
python3 -m http.server 8901
# → http://localhost:8901/index.html
```

## What's replicated (validated against the site's own JS bundle)

| Piece                                                                                                                                                                                                | Source                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Surface functions — Convex Circle / Convex Squircle / Concave / Lip                                                                                                                                  | article §Creating the Glass Surface (exact formulas incl. smootherstep lip)                        |
| Displacement profile — Snell refraction, 127→256 ray samples                                                                                                                                         | article §Vector Field (matches the site's pre-generated maps to ~1/255)                            |
| Displacement map — R = Δx, G = Δy, 128 neutral, 1px AA ring                                                                                                                                          | article §SVG Displacement Map (Qt)                                                                 |
| **Specular map** — `A = cos²(normal − light) × parabolic bump`, `RGB = √A`                                                                                                                           | reverse-engineered from the site's `specular-map-*.png` (top 191/220, left 64/128 at −60° — exact) |
| Filter chain — blur → feImage → feDisplacementMap → **saturate** → feImage → feComposite `in` → feFuncA slope → feBlend ×2                                                                           | extracted from the site's bundle                                                                   |
| Sliders — Specular Opacity 0–1/.01 · Specular Saturation 0–50/1 · Refraction Level 0–1/.01 · Blur Level 0–40/.1 · Specular Angle ±180° · Bezel Width 0–100 · Glass Thickness 0–100 · Scale Ratio 0–1 | exact ranges from the site's inputs                                                                |

## Why the rim now "reflects the background"

The rim is **not painted**. `feComposite operator="in"` masks the
_saturated, refracted background_ with the specular ring, then
`feBlend` puts the white highlight on top. That is the site's exact
construction — the rim colour always comes from the backdrop.

## Extras (kept minimal, for back-filling the app)

- Corner Radius + Panel Size — the app's panels aren't 320×42 capsules.
- Presets = the site's demo values (Searchbox / Switch / Slider /
  Music Player / Magnifying Glass).
- Copy CSS tokens / Copy JSON.
- App plates (d/e/f/g × light/dark) + "Use image background"
  (the site's own toggle) for a high-contrast refraction test.
- Radius Simulation · Radius Displacements curve · Displacement Map
  preview — the article's playground visualisations.

## Notes

- `backdrop-filter: url(#lgf)` works in Chromium only; the page
  detects and falls back to a frosted style with a banner.
- Maps regenerate automatically on panel size, zoom (DPR) or geometry
  changes; opacity/saturation/refraction/blur are instant attribute
  updates (no rebuild).
- Scale = 2 × max displacement × Refraction Level × Scale Ratio —
  feDisplacementMap's real offset is `scale·(channel/255 − 0.5)`, so
  the status line reports true pixel shift.
