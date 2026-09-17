# Liquid Glass — The Real Technique (Web Implementation)

Research synthesis: Apple HIG "Liquid Glass" (developer.apple.com, WWDC25 sessions) + web community implementations (post-WWDC25 CodePen/repo wave). This doc defines how we build the real thing, not frosted blur.

---

## 1. Why what we have now is NOT liquid glass

Current `.glass-1/2/3` = `backdrop-filter: blur() saturate()` + semi-transparent fill + 1px border.

That is **iOS 8 frosted glass** — the 2014 material. Apple's Liquid Glass (2025) is a simulated **lens**, and the difference is visible in 4 missing layers:

| # | Layer | What it does | What we have now |
|---|-------|--------------|------------------|
| 1 | **Refraction (lensing)** | Backdrop content near edges bends inward, like looking through a thick glass puck | ❌ none |
| 2 | **Specular highlight** | Bright rim on the top edge (light from above), subtle on sides | ❌ weak 1px inset |
| 3 | **Bezel (edge thickness)** | The rim reads as a 3D glass edge — gradient border, bright top → dark bottom | ❌ flat 1px border |
| 4 | **Content infusion / tinting** | Glass picks up ambient color + white gradient sheen that shifts with motion | ❌ static flat fill |

The blur is only the substrate. Without layers 1–3 it reads as "smudged background", which is exactly what you saw.

## 2. The anatomy recipe (CSS/SVG, Chromium-first, graceful fallback)

### Layer 1 — Refraction: SVG displacement on the backdrop
The trick the community converged on after WWDC25:

```html
<!-- Rendered ONCE at app root -->
<svg width="0" height="0">
  <filter id="lg-displace" x="0%" y="0%" width="100%" height="100%">
    <feImage href="data:image/svg+xml,..." result="map" />
    <feDisplacementMap in="SourceGraphic" in2="map" scale="70"
        xChannelSelector="R" yChannelSelector="G" />
  </filter>
</svg>
```

The `feImage` is a displacement map: **red channel = X offset, green = Y offset**. The map is built from gradient rectangles hugging each edge — edge pixels encode "pull inward", center encodes "no displacement". Result: the backdrop visually *bends into the bezel* — the lensing that makes Liquid Glass look like a physical object.

```css
.lg-refract {
  /* Chromium: displacement + blur */
  backdrop-filter: url(#lg-displace) blur(6px) saturate(1.6);
}
@supports not (backdrop-filter: url(#x)) {
  .lg-refract { backdrop-filter: blur(20px) saturate(1.8); }
}
```

**Browser support, honestly:**
- Chrome/Edge (Chromium ≥ ~120): `backdrop-filter: url(#svg-filter)` works — full effect
- Safari 18/19: NO SVG filters in backdrop-filter → falls back to blur+specular (still good, see below)
- Firefox: no `url()` in backdrop-filter → same fallback

This is fine: **the specular + bezel layers carry the effect on Safari/Firefox.** The displacement is the cherry on Chromium.

### Layer 2 — Specular highlight (the #1 thing that sells "glass")
Stacked inset shadows, bright at top where "light" hits:

```css
.lg-spec {
  box-shadow:
    inset 0 1px 1px -0.5px rgba(255, 255, 255, 0.55),   /* crisp top rim */
    inset 0 -1px 1px -0.5px rgba(0, 0, 0, 0.10),        /* soft bottom inner shadow */
    inset 1px 0 1px -1px rgba(255, 255, 255, 0.25),      /* side rims */
    inset -1px 0 1px -1px rgba(255, 255, 255, 0.25),
    0 10px 40px -10px rgba(34, 30, 74, 0.18);            /* drop shadow: panel floats */
}
```

### Layer 3 — Bezel: gradient border via pseudo-element
A 1px border can't hold a gradient. Use a wrapping pseudo-element with `padding: 1px` and a linear-gradient background → the border itself goes bright-top → transparent-sides → dark-bottom. That's the glass *edge thickness*.

```css
.lg-bezel { position: relative; }
.lg-bezel::before {
  content: "";
  position: absolute; inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(180deg,
    rgba(255,255,255,0.7) 0%,
    rgba(255,255,255,0.15) 30%,
    rgba(255,255,255,0) 60%,
    rgba(255,255,255,0.1) 100%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
          mask-composite: exclude;
  pointer-events: none;
}
```

### Layer 4 — Sheen: diagonal white gradient that responds to pointer
The "liquid" part — the sheen moves:

```css
.lg-sheen::after {
  content: "";
  position: absolute; inset: 0;
  border-radius: inherit;
  background: radial-gradient(600px circle at var(--mx, 70%) var(--my, 0%),
    rgba(255,255,255,0.14), transparent 40%);
  pointer-events: none;
  transition: background 0.3s ease;
}
/* JS: onPointerMove → set --mx/--my as % — one listener per panel, GPU cheap */
```

### Text legibility on glass (your "distinguishable writing" note)
Apple darkens/raises opacity *locally behind text*. Practical web version:
- Panels: keep fill at ~0.6 white **plus** text-shadow `0 1px 1px rgba(255,255,255,0.45)` on light glass (knockout effect)
- Headings on glass: slightly heavier weight + tiny shadow
- Dark glass (sidebar): text-shadow `0 1px 2px rgba(0,0,0,0.4)`, fill opacity up
- Never pure `bg-white` — always the tinted gradient so the material reads as material

## 3. Proposed token architecture v2

```
.lg          → full stack: blur base + specular + bezel + sheen      (cards, topbar, dropdowns)
.lg-strong   → + displacement refraction (Chromium) + higher fill     (modals, drawers, mobile sidebar)
.lg-dark     → inverted specular on ink                              (desktop sidebar)
.lg-inset    → concave variant: inner shadow instead of rim           (inputs, wells, search)
```

All four share the displacement SVG (one `<GlassFilters/>` component at App root).
`prefers-reduced-motion` → sheen off, displacement off, blur stays.

## 4. Cost / risk check

- **Perf**: displacement backdrop is the expensive one — limit `lg-strong` to modals/drawers only (few, transient). Static panels use specular+bezel+blur (cheap). Sheen = gradient repaint only.
- **Safari/Firefox**: fallback stack still reads as glass (this is what most "liquid glass" web demos actually look like outside Chromium).
- **Build risk**: pure CSS + one SVG component — no deps.

## 5. Bundled fixes (from QA sheet) — same pass

1. **Topbar mock notif**: the dropdown content is hardcoded fake data and there is NO notification service in the codebase. Plan: derive real notifications from live data (recent ungraded submissions + active exams via existing services), empty state «اطلاعیه‌ای نیست», count badge = real number (0 → hide dot). Close on outside-click (useRef + pointerdown listener). Fix z-index so it no longer collides with the «سوال جدید» button.
2. **Sidebar logo**: TheMark size 48→~64px, re-add goldpop on mount, more presence.
3. **Nav group labels**: smaller (10px), lighter, letter-spaced — clear hierarchy vs items.
4. **Hero**: glows were too subtle — raise to visible bloom; TheMark watermark currently mispositioned (circle behind button) — reposition as edge-fading watermark at container start.
5. **Stats numbers**: align baselines across cards (flex-end + same line-height).
6. **Hamburger position**: move from screen top-left to inside Topbar (right side, before title — RTL-consistent), sidebar still slides from right.
7. **Classes**: school-name field (needs `ClassGroup` type + form + service addition) — noted, do AFTER the visual pass.
8. **Students class picker**: existing-classes dropdown instead of free text — also after visuals.

## 6. Order of work

1. `GlassFilters` SVG + `.lg-*` system v2 in index.css
2. Topbar + Sidebar first (highest visibility), with real notif
3. UIComponents: Card/Modal/Drawer/Toast/Button/Input migrate to lg-*
4. Dashboard hero + stats + sections
5. Remaining pages inherit via Card (mostly free)
6. typecheck + test + build → push → you re-QA
