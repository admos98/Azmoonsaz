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
 * Values live in src/index.css (single source of truth). If you change a value
 * here, you are changing the material contract — re-run the pixel evidence
 * pipeline and update the audit doc.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '../../..');
const cssRaw = readFileSync(join(root, 'src/index.css'), 'utf8');
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

/** Component source, line-comments stripped so doc mentions of retired
 *  classes don't trip the absence gates. */
function component(path: string): string {
  return readFileSync(join(root, path), 'utf8')
    .replace(/\r/g, '') // autocrlf checkouts are CRLF; // strips need line ends
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/^\s*\/\/.*$/, ''))
    .join('\n');
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
    // boost is a TOKEN so dark can take more: at 0.18 a white heading behind
    // a dark menu transmitted as a blurred band (+83 lum over the floor).
    // 0.36+0.34 = 0.70 plus the dark 26px body blur measures +35. Cards take
    // no boost (glx = a1), so this never touches them.
    expect(css).toMatch(/--glass-p-fa1:\s*calc\(var\(--glass-p-a1\) \+ var\(--glass-p-boost1\)\)/);
    expect(token('--glass-p-boost1')).toBe('0.24');
    expect(token('--glass-p-boost1', ":root[data-theme='dark']")).toBe('0.34');
    expect(token('--glass-p-boost2', ":root[data-theme='dark']")).toBe('0.26');
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

  it('menus and notif center cast NOTHING: halo + veil layers are gone', () => {
    const topbar = component('src/components/Topbar.tsx');
    expect(topbar).not.toMatch(/area-blur|bgfx/);
    // avatar name panel grows rightward from the physical screen-left circle
    // (logical props mirrored it off-screen); the bell slides clear while
    // open; text hugs the circle instead of riding the far edge
    expect(topbar).toMatch(/left-\[14px\]/);
    expect(topbar).toMatch(/justify-end whitespace-nowrap/);
    expect(topbar).toMatch(/translate-x-\[124px\]/);
    // hero buttons share one cross-axis baseline (icon vs text drift on mobile)
    expect(css).toMatch(/\.dashboard-hero-actions\s*\{[^}]*align-items:\s*stretch/s);
    expect(css).toMatch(/\.dashboard-hero-actions > button\s*\{[^}]*justify-content:\s*center/s);
    // hero light fields live INSIDE the panel (oversized blurred squares bled
    // a sharp sliver past the rounded corner on mobile GPUs + cost fullscreen
    // blur passes per frame)
    const dash = component('src/pages/teacher/Dashboard.tsx');
    expect(dash).toMatch(/w-\[20rem\] h-\[20rem\] max-w-full max-h-full/);
    expect(dash).toMatch(/w-60 h-60 max-w-full max-h-full/);
    expect(dash).not.toMatch(/w-\[28rem\]/);
    const ui = component('src/components/UIComponents.tsx');
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
    expect(denest).toContain(':is(.glx, .glx-strong, .glx-dark, .lens, .pane, .drop):not(.lg-root)');
    expect(denest).toMatch(
      /:is\(\.field, \.frost, \.chrome-blur, \.btn-glass\)\s*\{[^}]*backdrop-filter:\s*none/s,
    );
    const quietRule = denest.match(
      /:is\(\.field, \.frost, \.chrome-blur, \.btn-glass\)\s*\{[^}]+\}/,
    )![0];
    expect(quietRule).not.toMatch(/background|box-shadow/);
    // and no material paints a rim in markup: Card maps light→lens, strong→pane
    // (rims come from the filters) and edgeClass is permanently empty
    const ui = component('src/components/UIComponents.tsx');
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
    expect(engine).toMatch(
      /<filter id="\$\{esc\(id\)\}" x="0" y="0" width="100%" height="100%"/,
    );
    // 2) absolute feImage sizes = the element's CSS px (playground contract)
    expect(engine).toMatch(/width="\$\{esc\(W\)\}" height="\$\{esc\(H\)\}"/);
    // 3) NO blur primitive in the chain — blur stays in the CSS chain (GPU);
    //    the SVG chain only bends/saturates/rims the already-blurred backdrop
    expect(engine).not.toMatch(/feGaussianBlur/);
    // 4) the specular rim construction (backdrop-derived, never painted)
    expect(engine).toMatch(/feComposite in="saturated_dimmed" in2="specular_layer"/);
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

  it('the material family: six named surfaces, one design language', () => {
    const darkScope = ":root[data-theme='dark']";
    // ── tokens: the kube.io replica tune, 1:1 (playground export) ──
    expect(token('--lens-dim')).toBe('0.10'); // rgb-dim IN the lens/pane filters (user: light panels too dark at 0.15)
    expect(token('--lens-dim', darkScope)).toBe('0.07'); // the ONE dark change (user: dark menu/dim band)
    expect(token('--glass-fill')).toBe('0'); // glassBg: transparent, like the playground
    expect(token('--glass-fill', ":root[data-glass='lite']")).toBe('0.32');
    expect(token('--glass-fill', ":root[data-glass='off']")).toBe('0.85');
    expect(token('--dim-tint')).toBe('103 100 112');
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
    // drop: a circle with its own blur + a static ring where the probe is off
    expect(util('drop')).toMatch(/border-radius: 9999px/);
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
    // below-fold skipping: refracting cards skip rendering off-screen at zero
    // filter cost, holding their scroll footprint (intrinsic-size auto).
    expect(css).toMatch(/@utility cv-card\s*\{[^}]*content-visibility:\s*auto/s);
    expect(css).toMatch(/contain-intrinsic-size:\s*auto/);
    // push: the tint turns up (resting 16% -> 34%)
    expect(token('--btn-tint-mix')).toBe('16%');
    expect(css).toMatch(/\.btn-glass:active\s*{\s*--btn-tint-mix:\s*34%/);
    // transparent buttons materialize on THE MARK gold (docs/brand-the-mark.md)
    expect(css).toMatch(/\.btn-glass--bare:hover,\s*\.btn-glass--bare:focus-visible/);
    expect(css).toMatch(/--btn-tint:\s*var\(--color-gold\)/);
    expect(css).toMatch(/\.btn-glass--bare:active\s*{\s*--btn-tint-mix:\s*26%/);
    // hamburger menu items carry brand ink at rest (tertiary-on-menu-glass
    // read grey-on-grey); scoped to hamburger panels, bare stays quiet elsewhere
    expect(css).toMatch(/\[id\^='hamburger-panel-'\] \.btn-glass--bare\s*{\s*color:\s*var\(--color-ink\)/);
    // bare hover is faster (120ms) and subtler (8% wash) — a tint breath
    expect(css).toMatch(/\.btn-glass--bare:hover,[\s\S]*?--btn-tint-mix:\s*8%/);
    // modal X reads dismiss: red glass rest, near-solid red + white glyph hover
    expect(css).toMatch(/\.btn-glass--danger\.modal-close\s*{\s*--btn-tint-mix:\s*28%/);
    expect(css).toMatch(/\.btn-glass--danger\.modal-close:hover,[\s\S]*?--btn-tint-mix:\s*72%/);
    expect(component('src/components/UIComponents.tsx')).toMatch(/btn-glass--danger modal-close/);
    // notif + palette X carry the same red dismiss treatment (bare grey read
    // as disabled next to the red modal X)
    expect(component('src/components/Topbar.tsx')).toMatch(/btn-glass--danger modal-close/);
    expect(component('src/components/CommandPalette.tsx')).toMatch(/btn-glass--danger modal-close/);
    // menu hover runs ONE light turn (parked cursor drove 9s of full url()
    // re-runs per hover on the densest panels); page buttons keep 3 turns
    expect(css).toMatch(/\[id\^='hamburger-panel-'\] \.btn-glass:hover,[\s\S]*?animation-iteration-count:\s*1/);
    // primary CTA = brand Ink (the Mark's solid-fill colour), not the accent
    expect(css).toMatch(/\.btn-glass--primary\s*{\s*--btn-tint:\s*var\(--color-ink\)[^}]*/s);
    expect(css).toMatch(/\.btn-glass--primary\s*{[^}]*--btn-tint-mix:\s*24%/);
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
    expect(readFileSync(join(root, 'src/glass/glassController.ts'), 'utf8')).toMatch(/mountGlassEngine/);
    expect(readFileSync(join(root, 'src/glass/lensEngine.ts'), 'utf8')).toMatch(/buildFilterMarkup/);

    // ── options A+B: light menu blur cut + floating menu containment ──
    // A: light-only 6px->5px on the densest panels (shared token untouched,
    // dark keeps 6+2). 1px is side-by-side imperceptible on a 280px menu.
    expect(css).toMatch(
      /:root:not\(\[data-theme='dark'\]\) \.lens\.lens--menu\s*\{\s*backdrop-filter:\s*blur\(5px\);/s,
    );
    // B: contain: layout paint on both floating wrappers (invalidation stays
    // in the dropdown subtree). NOT strict/size (would collapse auto panels).
    expect(css).toMatch(/@utility contain-menu\s*\{[^}]*contain:\s*layout paint/s);
    expect(component('src/components/Topbar.tsx')).toMatch(
      /fixed z-\[60\] flex flex-col gap-3 contain-menu/,
    );
    expect(component('src/components/Topbar.tsx')).toMatch(
      /fixed z-\[60\] @container contain-menu/,
    );
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
    expect(css).toMatch(
      /\[class~='rounded-full'\],[\s\S]*?\{\s*\n\s*corner-shape: round;/,
    );
    expect(css).not.toMatch(/\[class\*='-full'\]/);
    expect(css).not.toMatch(/corner-shape: squircle/);
    // the engine reads the same exponent and CHROMIUM'S 2^k parameterization
    expect(readFileSync(join(root, 'src/glass/mapMath.ts'), 'utf8')).toMatch(/2\^k|2, k\)/);
    const controller = readFileSync(join(root, 'src/glass/glassController.ts'), 'utf8');
    expect(controller).toMatch(/--corner-exp/);
    expect(controller).toMatch(/mapCornerExp/);
  });

  it('dark login token pin exists (white-on-white regression fix)', () => {
    expect(css).toMatch(
      /:root\[data-theme='dark'\] \.login-shell\s*\{[^}]*--color-ink:\s*#1a1a2e/s,
    );
  });
});
