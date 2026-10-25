/**
 * Liquid-glass material contract — the pixel-audit gates, enforced statically.
 *
 * The 2026-09-27 audit measured our glass against iOS 26 references pixel by
 * pixel and found: fill acting as an opaque veil (rim == fill, zero specular
 * contrast), backdrop text legible through panels (blur too weak), dark panels
 * lifting only +7 luminance over the floor (iOS: +25..+70), and no dispersion.
 * These tests pin the token values that fix each finding, so a regression
 * fails the suite instead of shipping unnoticed.
 *
 * Values live in src/styles/ (single source of truth, via the index.css
 * @import chain). If you change a value here, you are changing the material
 * pipeline and update the audit doc.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot as root, component } from '../sourceReader';
import { readBundledCss } from '../cssConcat';
const cssRaw = readBundledCss();
const html = readFileSync(join(root, 'index.html'), 'utf8');
/** The boot script moved out of index.html into /public/boot.js: Vercel's CSP
 *  (script-src 'self') blocked the inline copy in production, so data-lens /
 *  data-glass / data-theme never ran on the live site. Assert on the real file
 *  AND that index.html only ever loads it same-origin. */
const boot = readFileSync(join(root, 'public/boot.js'), 'utf8');
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

describe('glass material contract (pixel-audit gates)', () => {
  it('light: panel body blur sits in the iOS chrome band (12-20px; the rim reads as light over a soft field)', () => {
    const v = token('--glass-p-blur');
    expect(v).not.toBeNull();
    const b = parseFloat(v!);
    expect(b).toBeGreaterThanOrEqual(12);
    expect(b).toBeLessThanOrEqual(20);
    const bg = parseFloat(token('--glass-bg-blur')!);
    expect(bg).toBeGreaterThanOrEqual(7);
    expect(bg).toBeLessThanOrEqual(9);
  });

  it('light: fill is a defined pane, not paint (iOS 26 reference: panels ~80-85% clear)', () => {
    // With the deepened plate, 0.14 read as "transparent with a floating ring".
    // 0.20 keeps the panel ON the page while the field reads through. Upper
    // bound guards against drifting back toward the 0.50 "putty" band.
    const v = token('--glass-p-a1');
    expect(v).not.toBeNull();
    const a = parseFloat(v!);
    expect(a).toBeGreaterThanOrEqual(0.16);
    expect(a).toBeLessThanOrEqual(0.24);
  });

  it('light: panels are DIMMED, not lightened — the floor sits below the page', () => {
    const a1 = token('--glass-dim-a1');
    expect(parseFloat(a1!)).toBeGreaterThan(0); // light mode dims
    const darkA1 = token('--glass-dim-a1', ":root[data-theme='dark']");
    expect(parseFloat(darkA1!)).toBe(0); // dark is already the dark floor
  });

  it('grain is RETIRED — Apple glass is perfectly smooth (user: "i hate the grain … apple never uses grain")', () => {
    expect(css).not.toMatch(/--glass-grain/);
    // the diagonal `112deg` glint was retired too — it painted a stripe
    // inside every panel (~+16 lum, measured in crop image_277b16.png)
    expect(css).not.toMatch(/linear-gradient\(\s*112deg/);
  });

  it('light: saturation stays iOS-subtle (1.4–1.6; 1.7 read as candy next to the page)', () => {
    const p = token('--glass-p-sat');
    expect(p).not.toBeNull();
    expect(parseFloat(p!)).toBeGreaterThanOrEqual(1.4);
    expect(parseFloat(p!)).toBeLessThanOrEqual(1.6);
    const bg = token('--glass-bg-sat');
    expect(bg).not.toBeNull();
    expect(parseFloat(bg!)).toBeGreaterThanOrEqual(1.4);
    expect(parseFloat(bg!)).toBeLessThanOrEqual(1.6);
  });

  it('light: resting shadow is GONE — iOS liquid glass carries none (a == 0)', () => {
    const v = token('--glass-sh-a', ':root');
    expect(v).not.toBeNull();
    expect(parseFloat(v!)).toBe(0);
  });

  it('overlay elevation is zero in BOTH themes — glass casts no shadow (iOS 26)', () => {
    // "A whisper of shadow to restore the float" is the moulded-plastic cue;
    // the deep plate now supplies the floor lift. Zero in both themes.
    const light = token('--glass-sh-strong-a', ':root');
    expect(parseFloat(light!)).toBe(0);
    const dark = token('--glass-sh-strong-a', ":root[data-theme='dark']");
    expect(parseFloat(dark!)).toBe(0);
    expect(parseFloat(token('--glass-sh-a', ":root[data-theme='dark']")!)).toBe(0);
  });

  it('rim luminance ramp: soft fade that melts into the panel (ring machinery retired)', () => {
    // the soft fade rides the unmasked element shadow (masked layers would
    // clip it exactly where it must show); the painted ring (.glass-edge) is
    // retired — rims come from the lens filter's saturate pass
    expect(css).not.toMatch(/\.glass-edge/);
    expect(css).toMatch(/inset 0 0 1[46]px -6px rgb\(255 255 255 \/ var\(--glass-rim-fade\)\)/);
    expect(parseFloat(token('--glass-rim-fade')!)).toBeGreaterThan(0);
    expect(parseFloat(token('--glass-rim-fade', ":root[data-theme='dark']")!)).toBeGreaterThan(0);
  });

  it('dark: glass DIMS the backdrop like smoked glass (p-tint luminance <= 30) — the old 52-49-66 @ 0.56 was the gray putty the user photographed', () => {
    const v = token('--glass-p-tint', ":root[data-theme='dark']");
    expect(v).not.toBeNull();
    const [r, g, b] = v!.split(/\s+/).map(Number);
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    expect(lum).toBeLessThanOrEqual(30);
    // and the fill is translucent enough for the saturated backdrop to show
    const a1 = parseFloat(token('--glass-p-a1', ":root[data-theme='dark']")!);
    expect(a1).toBeGreaterThanOrEqual(0.34);
    expect(a1).toBeLessThanOrEqual(0.44);
  });

  it('dark: inset wells are translucent material, not opaque slabs (0.94 was a brick)', () => {
    const v = token('--ui-inset-fill', ":root[data-theme='dark']");
    expect(v).not.toBeNull();
    const a = parseFloat(v!.replace(/^rgba\([^,]+,[^,]+,[^,]+,/, ''));
    // ~0.62: the well stays clearly visible (pops from the panel) while the
    // material below still reads. The old 0.94 painted over the page.
    expect(a).toBeGreaterThanOrEqual(0.4);
    expect(a).toBeLessThanOrEqual(0.7);
  });

  it('dark: floor carries the brand navy hue (page bg blue channel >= 32)', () => {
    const v = token('--color-page-bg', ":root[data-theme='dark']");
    expect(v).not.toBeNull();
    const hex = v!.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    expect(b).toBeGreaterThanOrEqual(32); // #171622 → b=34; the old neutral #18161d had b=29
    expect(b).toBeGreaterThan(r); // blue-leaning = navy ink family
  });

  it('dark: fill alpha keeps the glass translucent (a1 0.34-0.44, was 0.56-0.62 = milk)', () => {
    // covered by the smoked-glass gate above; kept as a named pin so a
    // revert of one does not silently unpin the other
    const v = token('--glass-p-a1', ":root[data-theme='dark']");
    expect(parseFloat(v!)).toBeLessThanOrEqual(0.44);
  });

  it('painted rim machinery stays retired — rims come from the lens filter', () => {
    // no per-edge tint ring, no searchlight, no corner/ink paint tokens
    expect(css).not.toMatch(/--glass-edge-tint-/);
    expect(css).not.toMatch(/glass-edge-mid-f|glass-edge-bot-f/);
    expect(css).not.toMatch(/140% 90% at 50% 0%/);
    // static glint + fill-feather tokens died with the ::after layer
    expect(css).not.toMatch(/--glass-glint-a/);
    expect(css).not.toMatch(/--glass-fill-fade|--glass-fill-edge/);
  });

  it('glx-strong keeps its modal fill boost through derived alphas', () => {
    // (the ::after fill-feather left with .glass-edge: one fill, one filter,
    // on the element itself)
    // glx-strong keeps its modal fill boost through derived alphas — and the
    // boost is a TOKEN so each theme tunes it: light 0.24/0.17 (menu
    // material near 80% opacity); dark REDUCED to 0.16/0.12 — measured, the
    // old 0.36+0.34 = 0.70 composite kept only 33% of the backdrop's chroma
    // (the near-opaque navy film = "plastic"), 0.52 keeps ~2.4x that while
    // the 26px body blur still suppresses the band. Cards take no boost.
    expect(css).toMatch(/--glass-p-fa1:\s*calc\(var\(--glass-p-a1\) \+ var\(--glass-p-boost1\)\)/);
    expect(token('--glass-p-boost1')).toBe('0.24');
    expect(token('--glass-p-boost1', ":root[data-theme='dark']")).toBe('0.16');
    expect(token('--glass-p-boost2', ":root[data-theme='dark']")).toBe('0.12');
    // dark strong-tier body blur: the 22px experiment still let the band
    // through (+44); 26px cuts it to +35. Light keeps the 12-20px chrome band.
    expect(token('--glass-p-blur', ":root[data-theme='dark']")).toBe('26px');
    // dark hero slab fix: no opaque pane paint, no menu-density boost — the
    // plate bloom must compose through (measured +41 lum at the bloom zone)
    expect(token('--color-hero-pane', ":root[data-theme='dark']")).toBe('transparent');
    expect(css).toMatch(
      /:root\[data-theme='dark'\] #dashboard-hero-banner\s*{\s*--glass-p-boost1:\s*0;\s*--glass-p-boost2:\s*0;/s,
    );
  });

  it('no static hairline: the panel border is transparent in both themes', () => {
    expect(token('--glass-p-ba')).toBe('0');
    expect(token('--glass-p-ba', ":root[data-theme='dark']")).toBe('0');
    // off tier restores a visible border for solid panels
    expect(token('--glass-p-ba', ":root[data-glass='off']")).toBe('0.35');
  });

  it('inner bloom — light spills inside under the top rim (paint-only)', () => {
    expect(token('--glass-bloom-line-a')).toBe('0.24');
    expect(token('--glass-bloom-a')).toBe('0.38');
    expect(token('--glass-bloom-a', ":root[data-theme='dark']")).toBe('0.05');
    // dark keeps its own dim hairline (it used to inherit the 0.24 light value;
    // at 0.10 it painted a static full-width WHITE STRIPE across every dark
    // panel — hero/menus/notif — so it halved to 0.05)
    expect(token('--glass-bloom-line-a', ":root[data-theme='dark']")).toBe('0.05');
    expect(css).toMatch(/inset 0 1px 0 rgb\(255 255 255 \/ var\(--glass-bloom-line-a\)\)/);
  });

  it('lens displacement is computed by the engine from the physics tokens (no static filter ships)', () => {
    // index.html carries NO filter markup at all: a static one either used an
    // external feImage href (never loads inside backdrop-filter → uniform
    // whole-panel shift) or a single pre-baked map stretched over every size
    // (whole-panel displacement). See docs/liquid-glass-engine-audit.md C1-C3.
    const htmlCode = html.replace(/<!--[\s\S]*?-->/g, ''); // comments may mention the primitives
    expect(htmlCode).not.toMatch(/feDisplacementMap/);
    expect(htmlCode).not.toMatch(/feImage/);
    expect(htmlCode).not.toMatch(/<filter/);
    // the engine's scale formula = the playground's (2 · maxAbs · refraction ·
    // scale-ratio ≈ 40.3px at the token defaults → ±20.1px peak pull, inside
    // Apple's measured 8–14px band ceiling at the approved 43.67 token)
    expect(readFileSync(join(root, 'src/glass/lensEngine.ts'), 'utf8')).toMatch(
      /2 \* maxAbs \* p\.refraction \* p\.scaleRatio/,
    );
  });

  it('the per-panel runtime engine owns the family filters — no static defs', () => {
    // #lg-lens stays as the no-engine fallback for .glx surfaces only; the
    // app's .lens/.pane/.drop run through src/glass/ (playground's per-size
    // rebuild). No static #lens/#pane/#drop/*-dark filters must ship.
    expect(html).not.toMatch(/<filter id="lens"/);
    expect(html).not.toMatch(/<filter id="lens-dark"/);
    expect(html).not.toMatch(/<filter id="pane"/);
    expect(html).not.toMatch(/<filter id="pane-dark"/);
    expect(html).not.toMatch(/<filter id="drop"/);
    // the engine reads the CSS tokens and emits a chain per panel
    expect(readFileSync(join(root, 'src/glass/glassController.ts'), 'utf8')).toMatch(
      /mountGlassEngine/,
    );
    expect(readFileSync(join(root, 'src/glass/lensEngine.ts'), 'utf8')).toMatch(
      /buildFilterMarkup/,
    );
    // the scale formula the playground and the engine share
    expect(readFileSync(join(root, 'src/glass/lensEngine.ts'), 'utf8')).toMatch(
      /2 \* maxAbs \* p\.refraction \* p\.scaleRatio/,
    );
  });

  it('ONE background: the topo page plate — the depth-field stage is gone', () => {
    const app = readFileSync(join(root, 'src/App.tsx'), 'utf8');
    expect(app).not.toMatch(/app-bg-stage/);
    // the plate the user asked for is the only background
    expect(css).toMatch(
      /--page-plate:\s*url\('~\/backgrounds\/bg-d-(light|dark)\.svg'\)|--page-plate:\s*url\('\/backgrounds\/bg-d-(light|dark)\.svg'\)/,
    );
    expect(css).toMatch(/#app-teacher-shell::before/);
  });

  it('the plate SVGs carry explicit width/height (iOS <img> decode limits)', () => {
    // webglRenderer loads the plate through <img>; iOS applies image-decode
    // limits to that path, and a root with viewBox but no width/height fails
    // to decode there (field report: plate='img-err' on iPhone). Chromium
    // also sizes such a root 240x150 instead of the artwork's real size.
    for (const f of ['bg-d-light.svg', 'bg-d-dark.svg']) {
      const svg = readFileSync(join(root, 'public/backgrounds', f), 'utf8');
      expect(svg, `${f} root must carry width/height`).toMatch(
        /<svg[^>]*\bwidth="1600"[^>]*\bheight="1000"/,
      );
    }
  });

  it('menus and notif center cast NOTHING: halo + veil layers are gone', () => {
    const topbar = component('src/components/Topbar.tsx');
    expect(topbar).not.toMatch(/area-blur|bgfx/);
    // question drawer preview is code-split + deferred past open: the open
    // commit carries the light form tree only, the heavy renderer mounts one
    // frame later (previewReady) with a skeleton meanwhile, chunk preloaded
    // at page idle. End state identical — open choreography only.
    const questions = component('src/pages/teacher/Questions.tsx');
    expect(questions).toMatch(
      /const QuestionRenderer = lazy\(\(\) => import\('\.\.\/\.\.\/components\/QuestionRenderer'\)\)/,
    );
    expect(questions).toMatch(/requestAnimationFrame\(\(\) => setPreviewReady\(true\)\)/);
    expect(component('src/features/question-bank/QuestionDrawerPreview.tsx')).toMatch(/previewReady \? \(/); // CQ-11 split
    expect(questions).not.toMatch(/import QuestionRenderer from/);
    // avatar name panel is desktop-only (no hover on touch — mobile gets a
    // bigger avatar instead); bell push scoped to md+ for the same reason
    expect(topbar).toMatch(/hidden md:block \$/);
    expect(topbar).toMatch(/md:translate-x-\[124px\]/);
    expect(topbar).toMatch(/relative h-11 w-11 md:h-10 md:w-10 cursor-pointer/);
    // hero buttons share one cross-axis baseline (icon vs text drift on mobile)
    expect(css).toMatch(/\.dashboard-hero-actions\s*{[^}]*align-items:\s*stretch/s);
    expect(css).toMatch(/\.dashboard-hero-actions > button\s*{[^}]*justify-content:\s*center/s);
    // V0: one solid slab in the hero row, second action is quiet glass
    // (two --primary buttons read as a double-solid strip)
    expect(component('src/pages/teacher/Dashboard.tsx')).toMatch(
      /id="hero-btn-new-exam"[\s\S]{0,220}?btn-glass--primary/,
    );
    expect(component('src/pages/teacher/Dashboard.tsx')).toMatch(
      /id="hero-btn-questions"[\s\S]{0,220}?btn-glass--quiet/,
    );
    expect(component('src/pages/teacher/Dashboard.tsx')).not.toMatch(
      /id="hero-btn-questions"[\s\S]{0,220}?btn-glass--primary/,
    );
    // hero light fields live INSIDE the panel (oversized blurred squares bled
    // a sharp sliver past the rounded corner on mobile GPUs + cost fullscreen
    // blur passes per frame)
    const dash = component('src/pages/teacher/Dashboard.tsx');
    expect(dash).toMatch(/w-\[20rem\] h-\[20rem\] max-w-full max-h-full/);
    expect(dash).toMatch(/w-60 h-60 max-w-full max-h-full/);
    expect(dash).not.toMatch(/w-\[28rem\]/);
    const ui = component('src/ui');
    expect(ui).not.toMatch(/area-blur/);
    // and the utilities are dead in CSS too
    expect(css).not.toMatch(/@utility area-blur/);
    expect(css).not.toMatch(/@utility bgfx/);
    // click-away catchers remain, fully transparent
    expect(topbar).toMatch(/fixed inset-0 z-\[55\]" onClick/);
  });

  it('floating panels carry no fixed-colour border ring (CommandPalette panel)', () => {
    const palette = readFileSync(join(root, 'src/components/CommandPalette.tsx'), 'utf8');
    // the PANEL silhouette itself: no border class (internal row dividers are
    // fine — they are separators, not the glass edge)
    expect(palette).toMatch(
      /className="relative lens w-full max-w-xl overflow-hidden rounded-3xl"/,
    );
    // the rim lives IN the filter now — no painted glass-edge ring on the panel
    expect(palette).not.toMatch(/glx-strong glass-edge/);
  });

  it('the nested lens band is GONE (it bent the panel itself and doubled every filter)', () => {
    expect(css).not.toMatch(/\.glass-edge[^{]*::after\s*\{[^}]*backdrop-filter/s);
    expect(token('--glass-lens-t')).toBeNull();
  });

  it('no lensIn animation machinery — no backdrop-filter may ever animate', () => {
    // html[data-lens] IS allowed: it is the boot-time Chromium>=138 gate, set
    // once before first paint and never toggled at runtime. What is banned is
    // the old animated lens machinery (keyframes / runtime toggling).
    expect(css).not.toMatch(/@keyframes lensIn/);
    expect(css).not.toMatch(/data-lens\]['^ ]*[a-z-]+:\s*[^;]*(transition|animation)/);
  });

  it('the bend rides the panel chains, BLUR FIRST, url() added inline by the engine, gated on Chromium >= 138', () => {
    // .field rides the gates: inputs/dropdowns keep their fill, never bend.
    // The CSS gates carry ONLY blur+saturate (GPU-composited); the url(#…)
    // refraction is composed INLINE by glassController once the panel's map
    // exists — a static url() here referenced a dead filter (external feImage
    // hrefs never render inside backdrop-filter) and flashed on navigation.
    expect(css).toMatch(
      /:root\[data-lens='on'\]:not\(\[data-glass='lite'\]\):not\(\[data-glass='off'\]\)\s+\.glx:not\(\.field\)\s*\{[^}]*backdrop-filter:\s*blur\(var\(--glass-bg-blur\)\)\s+saturate\(var\(--glass-bg-sat\)\);/,
    );
    expect(css).toMatch(
      /:root\[data-lens='on'\]:not\(\[data-glass='lite'\]\):not\(\[data-glass='off'\]\)\s+\.glx-strong:not\(\.field\)\s*\{[^}]*backdrop-filter:\s*blur\(var\(--glass-p-blur\)\)\s+saturate\(var\(--glass-p-sat\)\);/,
    );
    // no static lens reference anywhere in CSS — the engine owns url()
    expect(css).not.toMatch(/url\('#lg-lens'\)|url\("#lg-lens"\)/);
    // the lens is purely ADDITIVE: the base utilities keep plain blur so a
    // paint-time url() failure can never strip blur again
    expect(css).toMatch(
      /@utility glx \{[\s\S]*?backdrop-filter:\s*blur\(var\(--glass-bg-blur\)\) saturate\(var\(--glass-bg-sat\)\);/,
    );
    // the boot probe sets the gate (external /boot.js — inline was CSP-blocked)
    expect(boot).toMatch(/dataset\.lens = major >= 138 \? 'on' : 'off'/);
    // the false-positive @supports syntax probe is GONE
    expect(css).not.toMatch(/@supports \(backdrop-filter:\s*url/);
  });

  it('glass never nests: glass descendants of a glass surface are flattened — except .lg-root panels', () => {
    // backdrop root scoping made nested filters useless and stacked fills
    // into a wash — the de-nest rule strips filter + rim on REAL nesting.
    // The engine never dresses nested elements (isNestedGlass skips them
    // before any map is built); .lg-root is a manual escape hatch, not a
    // live path — nothing writes it today.
    expect(css).toMatch(
      /:root:not\(\[data-glass='lite'\]\):not\(\[data-glass='off'\]\)\s+:is\(\.glx, \.glx-strong, \.glx-dark, \.lens, \.pane, \.drop\):not\(\.lg-root\)\s+:is\(\.glx, \.glx-strong, \.glx-dark, \.lens, \.pane, \.drop\)\s*\{[^}]*backdrop-filter:\s*none/s,
    );
    // the quiet materials (.field/.frost/.chrome-blur/.btn-glass) are flattened
    // by a FILTER-ONLY rule: nested in a backdrop root they sample the parent's
    // flat fill, so their blur renders nothing — but their fills/tints/rims are
    // the visible design and must survive (no background/box-shadow override).
    const denest = cssRaw.slice(cssRaw.indexOf('De-nest'), cssRaw.indexOf('Ink glass'));
    expect(denest).toContain(
      ':is(.glx, .glx-strong, .glx-dark, .lens, .pane, .drop):not(.lg-root)',
    );
    expect(denest).toMatch(
      /:is\(\.field, \.frost, \.chrome-blur, \.btn-glass\)\s*\{[^}]*backdrop-filter:\s*none/s,
    );
    const quietRule = denest.match(
      /:is\(\.field, \.frost, \.chrome-blur, \.btn-glass\)\s*\{[^}]+\}/,
    )![0];
    expect(quietRule).not.toMatch(/background|box-shadow/);
    // and no material paints a rim in markup: Card maps light→lens, strong→pane
    // (rims come from the filters) and edgeClass is permanently empty
    const ui = component('src/ui');
    expect(ui).toMatch(/light: 'lens'/);
    expect(ui).toMatch(/strong: 'pane'/);
    expect(ui).toMatch(/const edgeClass = '';/);
  });

  it('the tier probe never downgrades capable machines to blurless lite', () => {
    // navigator.deviceMemory reports 4 on many 16 GB machines — the old
    // cores<4 / memory<=4 downgrade shipped blurless plastic to real users
    expect(boot).not.toMatch(/cores\s*<\s*4/);
    expect(boot).not.toMatch(/memory\s*<=\s*4/);
    expect(boot).toMatch(/prefers-reduced-transparency/); // lite is a CHOICE now
  });

  it('CSP compliance: no inline scripts in index.html, boot loads same-origin and blocking', () => {
    // Vercel serves `Content-Security-Policy: script-src 'self'` (vercel.json).
    // The boot IIFE used to sit inline in index.html → blocked in production,
    // so data-theme / data-glass / data-lens were never set: the refraction
    // bend (selector :root[data-lens='on']) was dead on the live site and the
    // tier/theme gates never fired before paint. Boot lives in /public/boot.js.
    expect(html).toMatch(/<script src="\/boot\.js"><\/script>/);
    // zero inline <script> bodies (a script tag without src=)
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
    // blocking on purpose — the dataset gates must land before first paint
    expect(html).not.toMatch(/<script[^>]*src="\/boot\.js"[^>]*(defer|async)/);
    // the login-art preload left index.html (it fired on every route and
    // warned "preloaded but not used"); boot.js gates it on login path + no
    // persisted Supabase session
    expect(html).not.toMatch(/login-education/);
    expect(boot).toMatch(/-auth-token/);
    expect(boot).toMatch(/login-education-light\.avif/);
  });

  it('the render contract lives in lensEngine: explicit region, absolute feImage px, no in-chain blur', () => {
    // index.html carries NO filter markup (see the displacement test above).
    const engine = readFileSync(join(root, 'src/glass/lensEngine.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '') // comments may name the primitives
      .replace(/\/\/.*$/gm, '');
    // 1) explicit region — with the default -10%..120% region a percentage
    //    feImage subregion resolves against the REGION and the maps never
    //    paint where designed (whole-panel scale/2 shift). Audit C1.
    expect(engine).toMatch(/<filter id="\$\{esc\(id\)\}" x="0" y="0" width="100%" height="100%"/);
    // 2) absolute feImage sizes = the element's CSS px (playground contract)
    expect(engine).toMatch(/width="\$\{esc\(W\)\}" height="\$\{esc\(H\)\}"/);
    // 3) NO blur primitive in the chain — blur stays in the CSS chain (GPU);
    //    the SVG chain only bends/saturates/rims the already-blurred backdrop
    expect(engine).not.toMatch(/feGaussianBlur/);
    // 4) the specular rim construction (backdrop-derived, never painted):
    //    saturate is masked by the spec alpha and blended over the RAW
    //    backdrop; the dim wash runs ONCE after that blend (perf lever 1 —
    //    affine dim commutes with the alpha-weighted blend, verified in
    //    Chromium: max 2/255 LSB. See the CHAIN SHAPE doc in lensEngine).
    expect(engine).toMatch(/feComposite in="displaced_saturated" in2="specular_layer"/);
    expect(engine).toMatch(/feBlend in="rim_saturated" in2="displaced"/);
    expect(engine).toMatch(/feComponentTransfer in="withSaturation" result="dimmed"/);
    expect(engine).toMatch(/feFuncA type="linear" slope="\$\{esc\(p\.specOpacity\)\}"/);
  });

  it('glx surfaces carry the text micro-shadow ambient', () => {
    // NOTE: 'text-[s]hadow' is written split so the typography linter does not
    // mistake this CSS assertion for an undeclared typography utility.
    expect(css).toMatch(/text-[s]hadow:\s*0 1px 2px rgb\(var\(--glass-text-ambient\)/);
  });

  it('option rows on glass use the grouped-list material, not glass-on-glass fills', () => {
    // tokens exist per theme
    expect(token('--pref-row-bg')).not.toBeNull();
    expect(token('--pref-row-sel-bg', ":root[data-theme='dark']")).not.toBeNull();
    // utilities exist
    expect(css).toMatch(/@utility pref-row\s*\{/);
    expect(css).toMatch(/@utility pref-row-selected\s*\{/);
    // the selector consumes them
    const pref = readFileSync(join(root, 'src/components/PreferenceSelector.tsx'), 'utf8');
    expect(pref).toMatch(/selected \? 'pref-row-selected' : 'pref-row'/);
    expect(pref).not.toMatch(/gold-soft/);
  });


  it('dark login token pin exists (white-on-white regression fix)', () => {
    expect(css).toMatch(
      /:root\[data-theme='dark'\] \.login-shell\s*\{[^}]*--color-ink:\s*#1a1a2e/s,
    );
  });

  it('audit fixes: focus-ring split, wired form errors, stable type weights', () => {
    // F-1: light focus ring = ink (gold at 72% composited to 1.43:1 on warm
    // white — fails the 3:1 non-text minimum); dark keeps gold. The RATIOS
    // are asserted by tools/check-contrast.mjs in the check gate; the test
    // pins the split and the library consuming the token (Button/Toggle used
    // to hardcode --color-accent and bypass the shared ring entirely).
    expect(css).toMatch(/--color-focus-ring: #343242;/);
    expect(css).toMatch(
      /:root\[data-theme='dark'\]\s*\{[\s\S]*?--color-focus-ring: rgba\(245, 179, 1, 0\.72\)/,
    );
    const ui = component('src/ui');
    expect(ui).not.toMatch(/focus-visible:outline-\[var\(--color-accent\)\]/);
    // 4 = FOCUS_RING const definition + Button + Toggle (both hardcoded
    // accent before) + DataTable (already on the token); the three new
    // primitives consume the const instead of repeating the literal
    expect(ui.match(/focus-visible:outline-\[var\(--color-focus-ring\)\]/g)!.length).toBe(4);
    // F-4: aria wiring — index.css styles [aria-invalid='true'] but nothing
    // ever set it; errors were invisible to screen readers. Three field
    // components now associate the error/helper <p> by id.
    expect(ui.match(/aria-invalid=\{error \? true : undefined\}/g)!.length).toBe(3);
    // 4 = the three F-4 fields + Toggle's description association (F-9)
    expect(ui.match(/aria-describedby=/g)!.length).toBe(4);
    // 6 = 3 id assignments on the error <p> + 3 aria-describedby references
    expect(ui.match(/\$\{(?:inputId|fieldId|dropdownId)\}-error/g)!.length).toBe(6);
    // F-5: 650 snapped to 700 in any fallback during font-swap (weight shift);
    // display weight gets its own token so the "reserved for display" clamp
    // rule is executable in one place; label differentiates from caption
    // (both were 600, 1px apart — one role with two names).
    expect(css).not.toMatch(/font-weight: 650/);
    expect(css).toMatch(/@utility text-micro\s*\{[^}]*font-weight: 700/s);
    expect(css).toMatch(/--font-weight-display: 800/);
    expect(css).toMatch(
      /@utility text-display\s*\{[^}]*font-weight: var\(--font-weight-display\)/s,
    );
    expect(css).toMatch(/@utility text-label\s*\{[^}]*font-weight: 700/s);
    // F-3: the press-physics comment must describe the three real tiers
    // (global :where scale / .btn-glass sink / --still opt-out), not claim
    // "ONE physics" while three exist. cssRaw: comments are stripped from `css`.
    expect(cssRaw).toMatch(/Press physics — three deliberate tiers/);
    expect(cssRaw).not.toMatch(/ONE press physics/);
  });

  it('bubble loader — the sanctioned loop + block loaders converted', () => {
    // DOM contract in LibraryV2; this pins the CSS exception record and
    // the spinner migration at file level.
    expect(cssRaw).toMatch(/THE one sanctioned infinite loop/);
    expect(css).toMatch(
      /\.bubble-loader i\s*{[^}]*animation:\s*bubble-cycle 720ms steps\(1\) infinite/s,
    );
    expect(css).toMatch(/@keyframes bubble-cycle\s*{\s*0%\s*{\s*background:\s*var\(--color-gold\)/);
    expect(css).toMatch(
      /\[data-motion='reduce'\]\s*\.bubble-loader i:nth-child\(3\)\s*{\s*background:\s*var\(--color-gold\)/,
    );
    // block/page loaders converted to bubbles
    for (const f of [
      'src/App.tsx',
      'src/pages/teacher/Classes.tsx',
      'src/features/student-import/StudentImportWizard.tsx',
    ]) {
      expect(component(f), `${f} should no longer spin a ring`).not.toMatch(/animate-spin/);
    }
    // inline button slots keep the compact ring (bubbles don't fit a w-4)
    expect(component('src/ui/Button.tsx')).toMatch(
      /Loader2 className="w-4 h-4 animate-spin/,
    );
  });

  it('V3 skeleton — one sweep then rest, the looping shimmer is gone', () => {
    expect(css).not.toMatch(/shimmer/); // keyframe + class both gone
    expect(css).toMatch(/@keyframes skeleton-sweep\s*{\s*from\s*{\s*transform:\s*translateX\(160%\)/);
    // exactly one iteration, fill-mode parks it off-canvas
    expect(css).toMatch(/animation:\s*skeleton-sweep 1\.2s ease-out 1 both/);
    expect(css).toMatch(/:root\[data-theme='dark'\] \.skeleton\s*{\s*--skeleton-mix:\s*50%/);
    expect(cssRaw).toMatch(/one sweep, then rest/);
    // reduced motion parks the sweep; the Meraj تذهیب rule joins the group
    expect(css).toMatch(/:root\[data-motion='reduce'\] \.skeleton::after,\s*:root\[data-motion='reduce'\] \.tazhib-rule\s*{\s*animation:\s*none/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) {\s*.goldpop,\s*.skeleton,\s*.skeleton::after/);
  });

  it('C.3 seal — one 240ms sweep draw-in, no loop, reduced motion static', () => {
    expect(css).toMatch(/\.seal\s*{\s*animation:\s*seal-draw 240ms ease-out both/);
    expect(css).toMatch(
      /@keyframes seal-draw\s*{\s*from\s*{\s*clip-path:\s*inset\(0 100% 0 0\)/,
    );
    // parked by BOTH reduced-motion paths (attribute first in its group, media last)
    expect(css).toMatch(/:root\[data-motion='reduce'\] \.seal,\s*:root\[data-motion='reduce'\] \.goldpop/);
    expect(css).toMatch(/\.skeleton::after,\s*\.seal,\s*\.tazhib-rule\s*{\s*animation:\s*none/);
    // no loop anywhere on the seal
    expect(cssRaw).not.toMatch(/seal-draw [\d.]+s ease-out infinite/);
  });

  it('C.4 login hero — light-pinned key, fluid in the art panel, hidden <1024', () => {
    // login is a never-themed light surface: the LIGHT key, statically
    const login = component('src/pages/teacher/Login.tsx');
    expect(login).toMatch(/src="\/empty-art\/hero\/light\/hero\.png"/);
    expect(login).toMatch(/className="login-hero"/);
    // fluid, non-overlapping placement + the >=1024-only gate
    expect(css).toMatch(/\.login-hero\s*{[^}]*width:\s*min\(44%, 640px\)/);
    expect(css).toMatch(
      /@media \(max-width: 1023px\) {\s*.login-hero {\s*display: none/,
    );
  });

  it('V2 panel crest — reserved rail column, both states, art handoff', () => {
    // single column base; rail column reserved ≥lg in BOTH states
    expect(css).toMatch(
      /\.panel-crest\s*{\s*display:\s*grid;\s*grid-template-columns:\s*minmax\(0, 1fr\);/,
    );
    expect(css).toMatch(
      /@media \(min-width: 1024px\) {\s*\.panel-crest {\s*grid-template-columns:\s*minmax\(0, 1fr\) 136px;/,
    );
    expect(css).toMatch(/\.panel-crest\[data-state='filled'\] {\s*--crest-op:\s*0\.6/);
    expect(css).toMatch(
      /:root\[data-theme='dark'\] \.panel-crest\[data-state='filled'\] {\s*--crest-op:\s*0\.75/,
    );
    // empty ≥lg: the content column's centered copy hides — one illustration
    expect(css).toMatch(
      /\.panel-crest\[data-state='empty'\] \.panel-crest__content \.empty-state-art {\s*display:\s*none/,
    );
    // six hosts wired, one motif each
    const hosts: Record<string, string> = {
      Students: 'students',
      ExamResults: 'grading',
      Exams: 'exams',
      Questions: 'questions',
      TeacherProfile: 'scheduled',
      Classes: 'classes',
    };
    for (const [name, kind] of Object.entries(hosts))
      expect(component(`src/pages/teacher/${name}.tsx`)).toMatch(
        new RegExp(`<PanelCrest[\\s\\S]{0,90}kind="${kind}"`),
      );
  });

  it('C.5 second-surface empties — notifications CUT-1 @56, classes abs-5 + CTA', () => {
    // notifications: the bubble row at empty scale, neutral grammar (text carries)
    const topbar = component('src/components/Topbar.tsx');
    expect(topbar).toMatch(/<Cut kind="questions" size=\{56\} \/>/);
    expect(topbar).toMatch(/هیچ اعلانی نیست\./);
    // teacher-without-classes: the absence variant on the table empty + onboarding CTA
    const classes = component('src/pages/teacher/Classes.tsx');
    expect(classes).toMatch(/emptyArt=\{<AbsenceArt kind="no-classes" size=\{112\} \/>/);
    expect(classes).toMatch(/emptyTitle="هنوز کلاسی ندارید"/);
    expect(classes).toMatch(/emptyAction=\{[\s\S]{0,220}handleOpenModal/);
    // 56 is the sanctioned empty-state slot; the three icon slots stay the core
    expect(component('src/components/Cut.tsx')).toMatch(
      /type CutSize = 20 \| 24 \| 28 \| 56;/,
    );
    // keyed pairs on disk — both themes for every new C.5 asset
    for (const p of [
      'public/empty-art/absence/light/abs-5-no-classes.png',
      'public/empty-art/absence/dark/abs-5-no-classes.png',
      'public/empty-art/neutral/light/closed-box.png',
      'public/empty-art/neutral/dark/closed-box.png',
    ])
      expect(existsSync(join(root, p)), p).toBe(true);
  });

  it('C.6 favicon/PWA — CUT-1 derived onto the plum plate, manifest, old svg gone', () => {
    // index.html links the derived PNG set + manifest, no off-brand svg icon
    expect(html).toMatch(
      /<link rel="icon" type="image\/png" sizes="48x48" href="\/favicon.png"/,
    );
    expect(html).toMatch(
      /<link rel="apple-touch-icon" sizes="180x180" href="\/apple-touch-icon.png"/,
    );
    expect(html).toMatch(/<link rel="manifest" href="\/manifest.webmanifest"/);
    expect(html).not.toMatch(/favicon\.svg/);
    expect(existsSync(join(root, 'public/favicon.svg'))).toBe(false);
    // manifest: brand plate, both maskable icons
    const manifest = JSON.parse(
      readFileSync(join(root, 'public/manifest.webmanifest'), 'utf8'),
    );
    expect(manifest.theme_color).toBe('#221E4A');
    expect(manifest.background_color).toBe('#221E4A');
    expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual([
      '192x192',
      '512x512',
    ]);
    expect(
      manifest.icons.every((i: { purpose: string }) => i.purpose.includes('maskable')),
    ).toBe(true);
    // derivation pins: dark-key cut-1 (cream strokes read on the plum plate)
    const script = readFileSync(join(root, 'tools/art-gate/make-icons.py'), 'utf8');
    expect(script).toMatch(/"cuts", "dark", "cut-1\.png"/);
    expect(script).toMatch(/PLUM = \(34, 30, 74, 255\)/);
    // generated files on disk
    for (const p of [
      'public/favicon.png',
      'public/apple-touch-icon.png',
      'public/icon-192.png',
      'public/icon-512.png',
    ])
      expect(existsSync(join(root, p)), p).toBe(true);
  });
});
