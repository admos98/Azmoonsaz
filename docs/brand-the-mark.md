# ExamForge Brand Spec — The Mark (علامت) V2.0

Reference file for implementation. Exact SVG coordinates and rules below.

## Formula
- D = diameter (base unit)
- SPACING = 1.4 × D (center-to-center)
- STROKE = 0.22 × D (ring thickness, always uniform)
- GOLD = always 3rd of 4 circles, always filled (never ring)

## Colors
- Ink: #221E4A (circles, headings and solid fills)
- Gold: #F5B301 (answer mark, never changes)
- Cream: #F7F1E4 (accents and light solids)
- Muted: #6B6489 (secondary text)

### Page surfaces — the two materials

Agreed 2026-09-26. Light and dark are two different materials, both derived
from the Mark. The surfaces stay calm; the identity lives in type and accents.

| Theme | Page surface | Why it reads as The Mark |
|---|---|---|
| Light | `#FAF8F5` | The cream/gold hue (≈41°) lifted to near-white — paper from the Mark's own family, not a cool grey. Reads white; the warmth is the identity. |
| Dark | `#18161D` | Ink's hue pulled to 13% chroma / 10% lightness — violet-black, blue no longer dominant. Reads near-black; the violet cast is the identity. |

Ink `#221E4A` and Cream `#F7F1E4` are **demoted from page background to brand
colour** — they carry headings, solid fills and The Mark itself. This is how
"keep The Mark identity" and "much less blue, think white" are satisfied at the
same time.

Defined exactly once, in `src/index.css`: `--color-page-bg` and
`--color-paper-warm` (light in `@theme`, dark in `:root[data-theme='dark']`).
There is no second token file — `src/theme/` was deleted in Phase 1 because it
was unreferenced and had drifted back to a blue page (`#f0f7ff`) and an indigo
accent (`#6366f1`).

Provisional: reviewed by the user, who may order either value changed.

## SVG Variants

### Row (wordmark/header) — ≥24px
```svg
<svg viewBox="0 0 128.40 44.40">
  <circle cx="22.2" cy="22.2" r="10" fill="none" stroke="#221E4A" stroke-width="4.4"/>
  <circle cx="50.2" cy="22.2" r="10" fill="none" stroke="#221E4A" stroke-width="4.4"/>
  <circle cx="78.2" cy="22.2" r="10" fill="#F5B301"/>
  <circle cx="106.2" cy="22.2" r="10" fill="none" stroke="#221E4A" stroke-width="4.4"/>
</svg>
```

### App Icon (16–512px)
```svg
<svg viewBox="0 0 104 104">
  <circle cx="28" cy="28" r="14.5" fill="none" stroke="#221E4A" stroke-width="5.2"/>
  <circle cx="76" cy="28" r="14.5" fill="#F5B301"/>
  <circle cx="28" cy="76" r="14.5" fill="none" stroke="#221E4A" stroke-width="5.2"/>
  <circle cx="76" cy="76" r="14.5" fill="none" stroke="#221E4A" stroke-width="5.2"/>
</svg>
```

### Palette (question navigation)
```svg
<svg viewBox="0 0 108 108">
  <circle cx="20" cy="20" r="8" fill="none" stroke="#221E4A" stroke-width="3.6"/>
  <circle cx="54" cy="20" r="8" fill="none" stroke="#221E4A" stroke-width="3.6"/>
  <circle cx="88" cy="20" r="8" fill="none" stroke="#221E4A" stroke-width="3.6"/>
  <circle cx="20" cy="54" r="8" fill="none" stroke="#221E4A" stroke-width="3.6"/>
  <circle cx="54" cy="54" r="8" fill="#F5B301"/>
  <circle cx="88" cy="54" r="8" fill="none" stroke="#221E4A" stroke-width="3.6"/>
  <circle cx="20" cy="88" r="8" fill="none" stroke="#221E4A" stroke-width="3.6"/>
  <circle cx="54" cy="88" r="8" fill="none" stroke="#221E4A" stroke-width="3.6"/>
  <circle cx="88" cy="88" r="8" fill="none" stroke="#221E4A" stroke-width="3.6"/>
</svg>
```

### Favicon (core)
```svg
<svg viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="16.5" fill="none" stroke="#221E4A" stroke-width="5.6"/>
  <circle cx="32" cy="32" r="7.5" fill="#F5B301"/>
</svg>
```

## Animation
```css
.goldpop {
  transform-box: fill-box;
  transform-origin: center;
  animation: pop .55s cubic-bezier(.25, 1.6, .45, 1) both;
}
@keyframes pop {
  from { transform: scale(0); }
  70%  { transform: scale(1.15); }
  to   { transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .goldpop { animation: none; }
}
```

## Dark Mode
- Ink bg (#221E4A), cream strokes (#F7F1E4), gold unchanged (#F5B301)
- Empty circles: `fill="none" stroke="#F7F1E4"`
- Gold circle: `fill="#F5B301"` (never changes)

## Don'ts
1. ❌ Gold ring — gold is always filled
2. ❌ Two golds in one row — always exactly one
3. ❌ Rotation — bubbles align with text baseline
4. ❌ Varying stroke widths — all rings identical
5. ❌ Non-gold fill color — only ink/cream strokes + gold fill
