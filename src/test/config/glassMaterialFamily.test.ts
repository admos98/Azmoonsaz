/**
 * Liquid-glass material family — the six named surfaces and their physics.
 *
 * Extracted from glassMaterial.test.ts: the largest single `it` — the
 * whole family's token pins, utilities, button physics and gate checks.
 *
 * Values live in src/styles/ (single source of truth, via the index.css
 * @import chain). If you change a value here, you are changing the material
 * pipeline and update the audit doc.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot as root, component } from '../sourceReader';
import { readBundledCss } from '../cssConcat';
const cssRaw = readBundledCss();
const html = readFileSync(join(root, 'index.html'), 'utf8');
/** Comments stripped — they otherwise glue onto selectors and break exact
 *  block matching (regex token parsing only needs declaration bodies). */
const css = cssRaw.replace(/\/\*[\s\S]*?\*\//g, '');

/** Pull a custom property value out of the block whose selector matches
 *  `scope` EXACTLY (whitespace-normalized). Later blocks win only if they are
 *  the same selector — tier overrides like `:root[data-glass='lite']` or
 *  descendant pins like `:root[data-theme='dark'] .login-shell` are distinct
 *  selectors and are correctly ignored. */
function token(name: string, scope = ':root'): string | null {
  const target = scope.replace(/\s+/g, ' ').trim();
  let out: string | null = null;
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (m[1].replace(/\s+/g, ' ').trim() !== target) continue;
    const decl = new RegExp(`${name}:\\s*([^;]+);`).exec(m[2]);
    if (decl) out = decl[1].trim();
  }
  return out;
}

describe('liquid-glass material family — six named surfaces, one design language', () => {

  it('the material family: six named surfaces, one design language', () => {
    const darkScope = ":root[data-theme='dark']";
    // ── tokens: the kube.io replica tune, 1:1 (playground export) ──
    // parseFloat: prettier normalizes CSS numbers (0.10 -> 0.1); the pin is
    // the dim VALUE, not its spelling
    expect(parseFloat(token('--lens-dim'))).toBe(0.12); // rgb-dim IN the lens filters — highlight-weighted wash: mid-tones ≈ the accepted feel, whites compressed
    expect(token('--lens-dim', darkScope)).toBe('0.14'); // dark: a touch deeper (washed toward the glass navy, not black)
    expect(token('--glass-fill')).toBe('0'); // glassBg: transparent, like the playground
    expect(token('--glass-fill', ":root[data-glass='lite']")).toBe('0.32');
    expect(token('--glass-fill', ":root[data-glass='off']")).toBe('0.85');
    expect(token('--dim-tint')).toBe('31 29 41'); // deep slate — the wash target (was mid-grey 103 100 112: the additive putty floor)
    // both dim bases agree per theme — one value for the wash law, one for the lite/off fill
    expect(token('--glass-dim-tint')).toBe(token('--dim-tint'));
    expect(token('--glass-dim-tint', darkScope)).toBe('16 15 28');
    expect(token('--dim-tint', darkScope)).toBe('16 15 28');
    expect(token('--lens-blur')).toBe('1px'); // Blur Level 1.0px
    expect(token('--pane-blur')).toBe('calc(var(--lens-blur) * 2)'); // nested = 2x
    expect(token('--frost-blur')).toBe('calc(var(--lens-blur) * 2)');
    expect(token('--field-blur')).toBe('calc(var(--lens-blur) * 2)');
    expect(token('--drop-blur')).toBe('0.5px'); // a notch under lens
    expect(token('--btn-blur')).toBe('6px');
    expect(token('--btn-tint-mix')).toBe('16%'); // colored GLASS, not paint
    expect(token('--glass-veil-blur')).toBe('4px'); // modal veil, reduced per user
    // physics params parsed by tools/gen-glass-maps.py
    expect(token('--lens-surface')).toBe('convex_squircle');
    expect(token('--lens-bezel')).toBe('14px');
    expect(token('--lens-thickness')).toBe('66px');
    expect(token('--lens-refraction-level')).toBe('0.7');
    expect(token('--lens-scale-ratio')).toBe('1');
    expect(token('--lens-spec-opacity')).toBe('0.2');
    expect(token('--lens-spec-saturation')).toBe('4');
    expect(token('--lens-spec-angle')).toBe('-60deg');
    // rim thickness = 2×peak CSS px — playground parity (kube.io 1px)
    expect(token('--lens-spec-peak')).toBe('1px');
    expect(token('--corner-exp')).toBe('2');
    expect(token('--lens-radius')).toBe('21px');
    expect(token('--lens-size')).toBe('326px 64px');
    expect(token('--lens-max-displacement')).toBe('43.67px'); // +-21.8px peak
    expect(token('--drop-size')).toBe('44px 44px');
    expect(token('--drop-radius')).toBe('22px');
    expect(token('--drop-max-displacement')).toBe('5px'); // +-2.5px on a disc

    // ── the old panel-a/panel-b generation is DEAD — names never return ──
    expect(css).not.toMatch(/@utility panel-[ab]/);
    for (const dead of [
      '--panel-a-blur',
      '--panel-b-blur',
      '--panel-dim',
      '--panel-dim-tint',
      '--panel-fill',
      '--panel-lens-dim',
      '--panel-lens-surface',
      '--panel-lens-spec-opacity',
      '--panel-lens-max-displacement',
      '--panel-a-rim',
      '--panel-a-sat',
      '--panel-rim',
      '--panel-ink-a',
    ]) {
      expect(token(dead)).toBeNull();
    }

    // ── utilities: what each material paints ──
    const util = (u: string) => css.match(new RegExp(`@utility ${u} \\{[\\s\\S]*?\\n\\}`))![0];
    for (const [u, tok] of [
      ['lens', '--lens-blur'],
      ['pane', '--pane-blur'],
    ] as const) {
      const b = util(u);
      expect(b).toMatch(/background: rgb\(var\(--dim-tint\) \/ var\(--glass-fill\)\)/);
      expect(b).toMatch(new RegExp(`backdrop-filter: blur\\(var\\(${tok}\\)\\);`));
      expect(b).not.toMatch(/box-shadow|text-shadow|saturate|linear-gradient/);
    }
    // frost: same flat base, blur 2x, its own STATIC rim painted in CSS — the
    // only material allowed a box-shadow (reflective rims live in filters)
    const frost = util('frost');
    expect(frost).toMatch(/background: rgb\(var\(--dim-tint\) \/ var\(--glass-fill\)\)/);
    expect(frost).toMatch(/backdrop-filter: blur\(var\(--frost-blur\)\);/);
    expect(frost).toMatch(/inset 0 0 0 1px rgb\(255 255 255 \/ 0\.13\)/);
    expect(frost).not.toMatch(/text-shadow|saturate|linear-gradient/);
    // field: blur ONLY — host keeps the fill, no rim, no bend
    expect(util('field')).toMatch(/backdrop-filter: blur\(var\(--field-blur\)\)/);
    expect(util('field')).not.toMatch(/box-shadow|background|border:/);
    // drop: a circle with its own blur + a static ring where the prob…
    // (radius tokenized in V5 — --radius-full is 9999px, same circle)
    expect(util('drop')).toMatch(/border-radius: var\(--radius-full\)/);
    expect(util('drop')).toMatch(/backdrop-filter: blur\(var\(--drop-blur\)\)/);
    expect(css).toMatch(/:root:not\(\[data-lens='on'\]\) \.drop\s*\{[^}]*box-shadow/);
    // btn-glass: tinted glass, press states, NEVER a refraction
    const btn = util('btn-glass');
    expect(btn).toMatch(
      /color-mix\(in srgb, var\(--btn-tint\) var\(--btn-tint-mix\), transparent\)/,
    );
    expect(btn).toMatch(/backdrop-filter: blur\(var\(--btn-blur\)\) saturate\(1\.4\)/);
    expect(btn).toMatch(/color: var\(--color-text-primary\)/);
    expect(btn).not.toMatch(/url\(/);
    expect(css).toMatch(/\.btn-glass:hover,\s*\.btn-glass:focus-visible\s*\{[^}]*brightness/s);
    expect(css).toMatch(/\.btn-glass:disabled\s*\{[^}]*opacity/);
    for (const v of ['primary', 'danger', 'success', 'gold', 'quiet', 'bare', 'accent']) {
      expect(css).toMatch(new RegExp(`\\.btn-glass--${v} \\{`));
    }

    // ── the normal button physics (polish pass 1, user spec) ──
    // registered custom properties so the angle TWEENS instead of snapping
    expect(css).toMatch(/@property --btn-light-angle\s*{\s*syntax:\s*'<angle>'/);
    expect(css).toMatch(/@property --btn-tint\s*{\s*syntax:\s*'<color>'/);
    // hover: the light makes one full 360° circuit per 3s — size never changes.
    // THREE turns, not infinite: a parked cursor (or stuck touch-hover) would
    // otherwise drive compositor frames forever, re-running every url()
    // surface at 60fps. The end state IS the rest state (305 = -55 + 360),
    // so the stop is invisible and re-hover replays the sweep.
    expect(css).toMatch(
      /\.btn-glass:hover,\s*\.btn-glass:focus-visible\s*\{[^}]*animation:\s*btn-light-round 3s linear 3/s,
    );
    expect(css).toMatch(/@keyframes btn-light-round\s*{\s*from\s*{\s*--btn-light-angle:\s*-55deg/s);
    expect(css).toMatch(/--btn-light-angle:\s*305deg/); // -55 + 360 = seamless loop
    // reduced motion (OS or in-app) parks the circuit
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*{[^}]*animation:\s*none/s);
    expect(css).toMatch(/:root\[data-motion='reduce'\][^{]*\{\s*animation:\s*none/s);
    // pulse discipline: animate-pulse must NEVER loop forever — one looping
    // opacity anywhere keeps the compositor requesting frames (every url()
    // surface re-runs at 60fps while the user sits still). Blink, then rest.
    expect(css).toMatch(/\.animate-pulse\s*\{\s*animation-iteration-count:\s*3/s);
    // below-fold skipping RETIRED (2026-10-17): the cv-card placeholder
    // (contain-intrinsic-size 320px) jumped on scroll-in (+880px measured)
    // — the "panels resize / jelly" report. The utility must not come back.
    expect(css).not.toMatch(/@utility cv-card/);
    expect(css).not.toMatch(/content-visibility:\s*auto/);
    expect(component('src/pages/teacher/Dashboard.tsx')).not.toMatch(/cv-card/);
    expect(component('src/pages/teacher/Questions.tsx')).not.toMatch(/cv-card/);
    // Lever A: the bend is viewport-gated — an IntersectionObserver parks
    // offscreen panels on blur-only (inline url() cleared, key forgotten),
    // entry re-dresses from the MAP_TABLE cache hit (no worker rebuild).
    // Resting in-view output is byte-identical: zero visual loss by
    // construction. The flush-time rect + dress-time guards cover IO timing
    // gaps and worker maps resolving while offscreen.
    const gate = readFileSync(join(root, 'src/glass/glassController.ts'), 'utf8');
    expect(gate).toMatch(/IntersectionObserver/);
    expect(gate).toMatch(/VIEW_MARGIN/);
    expect(gate).toMatch(/isInExtendedViewport/);
    expect(gate).toMatch(/parkOffscreen/);
    // dead panels are unobserved (observers hold strong refs — without this a
    // removed panel is retained)
    expect(gate).toMatch(/viewObserver\?\.unobserve\(el\)/);
    expect(gate).toMatch(/resizeObserver\?\.unobserve\(el\)/);
    // push: the tint turns up (resting 16% -> 34%)
    expect(token('--btn-tint-mix')).toBe('16%');
    expect(css).toMatch(/\.btn-glass:active\s*{\s*--btn-tint-mix:\s*34%/);
    // transparent buttons materialize on THE MARK gold (docs/brand-the-mark.md)
    expect(css).toMatch(/\.btn-glass--bare:hover,\s*\.btn-glass--bare:focus-visible/);
    expect(css).toMatch(/--btn-tint:\s*var\(--color-gold\)/);
    expect(css).toMatch(/\.btn-glass--bare:active\s*{\s*--btn-tint-mix:\s*26%/);
    // hamburger menu items carry brand ink at rest (tertiary-on-menu-glass
    // read grey-on-grey); scoped to hamburger panels, bare stays quiet elsewhere
    expect(css).toMatch(
      /\[id\^='hamburger-panel-'\] \.btn-glass--bare\s*{\s*color:\s*var\(--color-ink\)/,
    );
    // bare hover is faster (120ms) and subtler (8% wash) — a tint breath
    expect(css).toMatch(/\.btn-glass--bare:hover,[\s\S]*?--btn-tint-mix:\s*8%/);
    // modal X reads dismiss: red glass rest, near-solid red + white glyph hover
    expect(css).toMatch(/\.btn-glass--danger\.modal-close\s*{\s*--btn-tint-mix:\s*28%/);
    expect(css).toMatch(/\.btn-glass--danger\.modal-close:hover,[\s\S]*?--btn-tint-mix:\s*72%/);
    expect(component('src/ui/Modal.tsx')).toMatch(/btn-glass--danger modal-close/);
    // notif + palette X carry the same red dismiss treatment (bare grey read
    // as disabled next to the red modal X)
    expect(component('src/components/Topbar.tsx')).toMatch(/btn-glass--danger modal-close/);
    expect(component('src/components/CommandPalette.tsx')).toMatch(/btn-glass--danger modal-close/);
    // menu hover runs ONE light turn (parked cursor drove 9s of full url()
    // re-runs per hover on the densest panels); page buttons keep 3 turns
    expect(css).toMatch(
      /\[id\^='hamburger-panel-'\] \.btn-glass:hover,[\s\S]*?animation-iteration-count:\s*1/,
    );
    // primary CTA = brand solid (1C): accent-solid slab + on-solid ink,
    // wash/circuit retired, press physics shared with the family
    expect(css).toMatch(/\.btn-glass--primary\s*{[^}]*background:\s*var\(--color-accent-solid\)/s);
    expect(css).toMatch(/\.btn-glass--primary\s*{[^}]*color:\s*var\(--color-text-on-solid\)/s);
    expect(css).toMatch(/\.btn-glass--primary\s*{[^}]*--btn-tint-mix:\s*0%/s);
    expect(css).toMatch(
      /\.btn-glass--primary:hover,\s*\.btn-glass--primary:focus-visible\s*{\s*animation:\s*none/s,
    );
    // selected chips keep the accent's own glass
    expect(css).toMatch(/\.btn-glass--accent\s*{\s*--btn-tint:\s*var\(--color-accent-solid\)/);
    // the burger: bare + STILL — no hover materialize, only rest + morph
    expect(css).toMatch(/\.btn-glass--still:hover/);
    expect(css).toMatch(/\.btn-glass--still:hover,[^{]*\{[^}]*animation:\s*none/s);
    expect(component('src/components/Topbar.tsx')).toMatch(
      /btn-glass btn-glass--bare btn-glass--still relative z-\[70\]/,
    );
    // the body fades in via the sheen multiplier (bare rests at 0)
    expect(css).toMatch(/--btn-sheen-a:\s*0;/);
    expect(css).toMatch(/rgb\(255 255 255 \/ calc\(0\.1 \* var\(--btn-sheen-a\)\)\)/);

    // frost/field carry NO url() — they run on every engine
    expect(util('frost')).not.toMatch(/url\(/);
    expect(util('field')).not.toMatch(/url\(/);

    // ── the runtime engine drives .lens/.pane — the static #lens chain is gone ──
    for (const id of ['lens', 'lens-dark', 'pane', 'pane-dark', 'drop']) {
      // the engine builds these at runtime per panel; no static filter defs
      expect(html).not.toMatch(new RegExp(`<filter id="${id}"`));
    }
    // utilities keep a plain-blur fallback so a no-engine page still works
    expect(css).toMatch(/@utility lens\s*\{[^}]*backdrop-filter:\s*blur\(var\(--lens-blur\)\)/);
    expect(css).toMatch(/@utility pane\s*\{[^}]*backdrop-filter:\s*blur\(var\(--pane-blur\)\)/);
    expect(css).toMatch(/@utility drop\s*\{[^}]*backdrop-filter:\s*blur\(var\(--drop-blur\)\)/);
    // engine owns the runtime url() hookup, gated on data-lens
    expect(readFileSync(join(root, 'src/glass/glassController.ts'), 'utf8')).toMatch(
      /mountGlassEngine/,
    );
    expect(readFileSync(join(root, 'src/glass/lensEngine.ts'), 'utf8')).toMatch(
      /buildFilterMarkup/,
    );

    // ── options A+B: menu blur cut + floating menu containment ──
    // A: menus run 3px in BOTH themes — the heavy lift moved into the dim
    // (see the dim-first pins below); blur only softens contours now.
    expect(css).toMatch(
      /:root:not\(\[data-theme='dark'\]\) \.lens\.lens--menu\s*\{\s*backdrop-filter:\s*blur\(3px\)\s+saturate\(var\(--lens-menu-sat/s,
    );
    // dark carries no extra blur anymore (6+2px was the plastic smear)
    expect(css).toMatch(
      /:root\[data-theme='dark'\] \.lens\.lens--menu\s*\{\s*backdrop-filter:\s*blur\(var\(--lens-menu-blur\)\)\s+saturate\(var\(--lens-menu-sat/s,
    );
    expect(css).not.toMatch(/blur\(calc\(var\(--lens-menu-blur\) \+ 2px\)\)/);
    // B: contain: layout paint on both floating wrappers (invalidation stays
    // in the dropdown subtree). NOT strict/size (would collapse auto panels).
    expect(css).toMatch(/@utility contain-menu\s*\{[^}]*contain:\s*layout paint/s);
    expect(component('src/components/Topbar.tsx')).toMatch(
      /fixed z-\[60\] flex flex-col gap-3 contain-menu/,
    );
    expect(component('src/components/Topbar.tsx')).toMatch(
      /fixed z-\[60\] @container contain-menu/,
    );
    // dim-first menus: the highlight-weighted wash carries the readability,
    // the 3px blur softens contours, and the menu SATURATE keeps the
    // backdrop's hue alive through the wash (vibrancy: without it the chain
    // returns 33% chroma = grey paint).
    expect(token('--lens-menu-dim')).toBe('0.30'); // the wash — blacks stay black, sat carries hue
    expect(token('--lens-menu-dim', darkScope)).toBe('0.32');
    expect(token('--lens-menu-sat')).toBe('1.4');
    expect(token('--lens-menu-sat', darkScope)).toBe('1.4');
    // the hamburger header no longer repeats the hero's date (1H)
    expect(component('src/components/Topbar.tsx')).not.toMatch(/formatPersianDate/);
    // ── the family rides every structural rule ──
    for (const tier of ['lite', 'off'] as const) {
      expect(css).toMatch(
        new RegExp(
          `:root\\[data-glass='${tier}'\\]\\s+:is\\([\\s\\S]*?\\.lens,[\\s\\S]*?\\.drop,[\\s\\S]*?\\)\\s*\\{\\s*backdrop-filter: none;`,
        ),
      );
    }
    // ── the Apple signature curve is ONE global system: a single exponent
    //    token shared with the lens engine (rim maps follow the painted
    //    corner), applied universally, circles exempt. The exemption list
    //    enumerates the exact Tailwind full-radius utilities — a greedy
    //    [class*='-full'] also matched `w-full` and silently gave the notif
    //    panel circular corners against a superellipse rim map (double
    //    corners). Chromium paints superellipse(k) as |x|^n+|y|^n=1 with
    //    n = 2^k — mapMath raises to 2^k so the rim follows the paint.
    expect(css).toMatch(/--corner-exp:\s*2;/);
    expect(css).toMatch(/--corner-shape:\s*superellipse\(var\(--corner-exp\)\);/);
    expect(css).toMatch(
      /\*,\s*\n\s*\*::before,\s*\n\s*\*::after\s*\{\s*\n\s*corner-shape: var\(--corner-shape\);/,
    );
    expect(css).toMatch(/\[class~='rounded-full'\],[\s\S]*?\{\s*\n\s*corner-shape: round;/);
    expect(css).not.toMatch(/\[class\*='-full'\]/);
    expect(css).not.toMatch(/corner-shape: squircle/);
    // the engine reads the same exponent and CHROMIUM'S 2^k parameterization
    expect(readFileSync(join(root, 'src/glass/mapMath.ts'), 'utf8')).toMatch(/2\^k|2, k\)/);
    // Post-extraction split (2026-10-20): the shader recipe (--corner-exp)
    // lives in glassPipeline.ts; its consumer (mapCornerExp in buildBucketSync)
    // lives in glassMaps.ts.
    const pipeline = readFileSync(join(root, 'src/glass/glassPipeline.ts'), 'utf8');
    const maps = readFileSync(join(root, 'src/glass/glassMaps.ts'), 'utf8');
    expect(pipeline).toMatch(/--corner-exp/);
    expect(maps).toMatch(/mapCornerExp/);
  });

});
