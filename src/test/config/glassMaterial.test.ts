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
import { readFileSync, existsSync } from 'node:fs';
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

  it('lens displacement matches Apple exactly (scale=28 → max ±14px = their measured ceiling)', () => {
    expect(html).toMatch(/scale="28"/);
    expect(html).not.toMatch(/scale="34"/); // ±17px overshot Apple's 8-14px band
  });

  it('the lens is ONE clean displacement off a GENERATED 4-fold symmetric PNG map', () => {
    // The map is /public/lens-map.png — generated by tools, radial Chebyshev,
    // exact (128,128) neutral interior, 4-fold symmetric by construction. It
    // replaced the previous two data-URI linear gradients merged with feBlend
    // screen, which rendered right-edge-only on Chromium >138 (the gradient's
    // percentage stops asymmetrically resolved under preserveAspectRatio=none).
    // RULE CHANGE (user, 2026-10-02): playground == app — feColorMatrix and
    // feBlend are part of the material-family chains (#lens{,-dark},
    // #pane{,-dark}, #drop — fed by GENERATED PNG feImages). The original
    // regression cause stays banned: data-URI gradients inside a filter.
    // displacement: lg-lens + lens x2 themes + drop = 4
    expect((html.match(/<feDisplacementMap/g) || []).length).toBe(4);
    expect(html).not.toMatch(/operator="arithmetic"/);
    // feImage: lg map + (lens disp+spec)x2 + (pane spec)x2 + (drop disp+spec)
    expect((html.match(/<feImage/g) || []).length).toBe(9);
    // saturate ring: lens x2 + pane x2 + drop = 5
    expect((html.match(/<feColorMatrix/g) || []).length).toBe(5);
    // 2 feBlend composites per filter: lens x2 + pane x2 + drop = 10
    expect((html.match(/<feBlend/g) || []).length).toBe(10);
    expect(html).toMatch(/href="\/lens-map\.png"/);
    // scale lives on the displacement node; the map file holds the geometry
    expect(html).toMatch(/scale="28"/);
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

  it('the bend rides the panel chains, BLUR FIRST and lens LAST, gated on Chromium >= 138', () => {
    // .field rides the gates: inputs/dropdowns keep their fill, never bend
    expect(css).toMatch(
      /:root\[data-lens='on'\]:not\(\[data-glass='lite'\]\):not\(\[data-glass='off'\]\)\s+\.glx:not\(\.field\)\s*\{[^}]*backdrop-filter:\s*blur\(var\(--glass-bg-blur\)\)\s+saturate\(var\(--glass-bg-sat\)\)\s+url\('#lg-lens'\)/,
    );
    expect(css).toMatch(
      /:root\[data-lens='on'\]:not\(\[data-glass='lite'\]\):not\(\[data-glass='off'\]\)\s+\.glx-strong:not\(\.field\)\s*\{[^}]*backdrop-filter:\s*blur\(var\(--glass-p-blur\)\)\s+saturate\(var\(--glass-p-sat\)\)\s+url\('#lg-lens'\)/,
    );
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

  it('glass never nests: every glass descendant of a glass surface is flattened', () => {
    // backdrop root scoping made nested filters useless and stacked fills
    // into a wash — the de-nest rule strips filter + rim + feather in one hit
    expect(css).toMatch(
      /:root:not\(\[data-glass='lite'\]\):not\(\[data-glass='off'\]\)\s+:is\(\.glx, \.glx-strong, \.glx-dark, \.lens\)\s+:is\(\.glx, \.glx-strong, \.glx-dark, \.lens\)\s*\{[^}]*backdrop-filter:\s*none/s,
    );
    // the SANCTIONED nested materials never get de-nested
    const denest = cssRaw.slice(cssRaw.indexOf('De-nest'), cssRaw.indexOf('Ink glass'));
    expect(denest).toContain(':is(.glx, .glx-strong, .glx-dark, .lens)');
    expect(denest).not.toMatch(/[.]pane|[.]frost|[.]field|[.]drop/);
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

  it('refraction filter #lg-lens is defined ONCE, single generated-PNG map, box-clipped', () => {
    expect(html).toMatch(/id="lg-lens"/);
    expect(html).toMatch(/feDisplacementMap/);
    expect(html).toMatch(/feImage/);
    // The previous two data-URI SVG gradients rendered right-edge-only on
    // Chromium (percentage stops resolving asymmetrically under
    // preserveAspectRatio=none). The map is now /public/lens-map.png —
    // generated by tools, 4-fold symmetric, (128,128) neutral interior — with
    // no in-SVG gradient left to quirk. Data-URI gradient URLs are banned.
    expect(html).not.toMatch(/data:image\/svg\+xml,%3ClinearGradient/);
    expect(html).not.toMatch(/%23808080/); // grayscale plateau trick — banned
    // Filter region must MATCH the element box. The old -20%/140% region made
    // the map a square 40% larger than the panel, so the displacement was
    // sampled on square geometry while the element clipped it to a rounded
    // rect — the result was a straight-edged blur sitting inside a curved
    // panel. Box-clipped geometry is what keeps the bend and the blur on the
    // same curve as the rim.
    expect(html).toMatch(/<filter id="lg-lens" x="0" y="0" width="100%" height="100%"/);
    expect(html).not.toMatch(/<filter id="lg-lens" x="-/);
    expect(html).not.toMatch(/<filter id="lg-lens"[^>]*width="1[24]0%"/);
    // exactly one definition — a duplicate id silently shadows the first
    expect(html.match(/id="lg-lens"/g)!.length).toBe(1);
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
    expect(token('--lens-dim')).toBe('0.15'); // rgb-dim IN the lens/pane filters
    expect(token('--lens-dim', darkScope)).toBe('0.06'); // the ONE dark change
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
    expect(token('--lens-thickness')).toBe('72px');
    expect(token('--lens-refraction-level')).toBe('0.5');
    expect(token('--lens-scale-ratio')).toBe('1');
    expect(token('--lens-spec-opacity')).toBe('0.34');
    expect(token('--lens-spec-saturation')).toBe('5');
    expect(token('--lens-spec-angle')).toBe('-55deg');
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
    // hover: the light makes one full 360° circuit per 3s — size never changes
    expect(css).toMatch(
      /\.btn-glass:hover,\s*\.btn-glass:focus-visible\s*\{[^}]*animation:\s*btn-light-round 3s linear infinite/s,
    );
    expect(css).toMatch(/@keyframes btn-light-round\s*{\s*from\s*{\s*--btn-light-angle:\s*-55deg/s);
    expect(css).toMatch(/--btn-light-angle:\s*305deg/); // -55 + 360 = seamless loop
    // reduced motion (OS or in-app) parks the circuit
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*{[^}]*animation:\s*none/s);
    expect(css).toMatch(/:root\[data-motion='reduce'\][^{]*\{\s*animation:\s*none/s);
    // push: the tint turns up (resting 16% -> 34%)
    expect(token('--btn-tint-mix')).toBe('16%');
    expect(css).toMatch(/\.btn-glass:active\s*{\s*--btn-tint-mix:\s*34%/);
    // transparent buttons materialize on THE MARK gold (docs/brand-the-mark.md)
    expect(css).toMatch(/\.btn-glass--bare:hover,\s*\.btn-glass--bare:focus-visible/);
    expect(css).toMatch(/--btn-tint:\s*var\(--color-gold\)/);
    expect(css).toMatch(/\.btn-glass--bare:active\s*{\s*--btn-tint-mix:\s*26%/);
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

    // ── the gates: blur first (CSS), bend last (filter), theme picks dim ──
    const gateBody = `\\[data-lens='on'\\]:not\\(\\[data-glass='lite'\\]\\):not\\(\\[data-glass='off'\\]\\)`;
    const gate = `:root${gateBody}`;
    const darkGate = `:root\\[data-theme='dark'\\]${gateBody}`;
    expect(css).toMatch(new RegExp(`${gate} \\.lens \\{[^}]*url\\('#lens'\\)`));
    expect(css).toMatch(new RegExp(`${gate} \\.pane \\{[^}]*url\\('#pane'\\)`));
    expect(css).toMatch(new RegExp(`${gate} \\.drop \\{[^}]*url\\('#drop'\\)`));
    expect(css).toMatch(new RegExp(`${darkGate}\\s*\\.lens \\{[^}]*url\\('#lens-dark'\\)`));
    expect(css).toMatch(new RegExp(`${darkGate}\\s*\\.pane \\{[^}]*url\\('#pane-dark'\\)`));
    // frost/field carry NO url() — they run on every engine
    expect(util('frost')).not.toMatch(/url\(/);
    expect(util('field')).not.toMatch(/url\(/);

    // ── the filters: playground chains, exactly one per id ──
    for (const id of ['lens', 'lens-dark', 'pane', 'pane-dark', 'drop']) {
      expect(html.match(new RegExp(`id="${id}"`, 'g'))!.length).toBe(1);
    }
    // maps are GENERATED artifacts (tools/gen-glass-maps.py), checked in
    for (const f of ['lens-map.png', 'lens-spec.png', 'drop-map.png', 'drop-spec.png']) {
      expect(existsSync(join(root, 'public', f))).toBe(true);
    }
    const specOpacity = token('--lens-spec-opacity')!;
    const specSat = token('--lens-spec-saturation')!;
    const dimTint = token('--dim-tint')!.split(' ').map(Number);
    // the playground's dimParams(): per-channel linear wash, toFixed(4)
    const dimTables = (base: number): string[] => {
      const [tr, tg, tb] = dimTint.map((c) => c / 255);
      const [ar, ag, ab] = [base, base * 1.0526, Math.min(1, base * 1.4737)];
      return [
        `slope="${(1 - ar).toFixed(4)}" intercept="${(ar * tr).toFixed(4)}"`,
        `slope="${(1 - ag).toFixed(4)}" intercept="${(ag * tg).toFixed(4)}"`,
        `slope="${(1 - ab).toFixed(4)}" intercept="${(ab * tb).toFixed(4)}"`,
      ];
    };
    const filt = (id: string) =>
      html.match(new RegExp(`<filter id="${id}"[\\s\\S]*?</filter>`))![0];
    const expectBoxClip = (f: string, id: string) => {
      expect(f).toMatch(
        new RegExp(
          `<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">`,
        ),
      );
      expect(f).not.toMatch(/x="-/);
    };
    const expectSpec = (f: string) => {
      expect(f).toMatch(/href="\/lens-spec\.png"[^>]*result="specular_layer"/);
      expect(f).toMatch(
        /<feComposite in="saturated_dimmed" in2="specular_layer" operator="in" result="specular_saturated"/,
      );
      expect(f).toMatch(`<feFuncA type="linear" slope="${specOpacity}"`);
      expect(f).toMatch(/<feBlend in="specular_faded" in2="withSaturation" mode="normal"/);
    };
    const expectDim = (f: string, dim: string) => {
      for (const line of dimTables(parseFloat(dim))) {
        expect(f.split(line).length - 1).toBe(2); // both feComponentTransfer blocks
      }
    };

    // lens: displacement + saturate ring + dim + specular (the full material)
    for (const [id, dim] of [
      ['lens', token('--lens-dim')!],
      ['lens-dark', token('--lens-dim', darkScope)!],
    ] as const) {
      const f = filt(id);
      expectBoxClip(f, id);
      expect(f).toMatch(
        /<feDisplacementMap in="SourceGraphic"[^>]*scale="43\.67"[^>]*result="displaced"/,
      );
      expect(f).toMatch(
        new RegExp(`type="saturate" values="${specSat}" result="displaced_saturated"`),
      );
      expect(f).toMatch(/href="\/lens-map\.png"[^>]*result="displacement_map"/);
      expectSpec(f);
      expectDim(f, dim);
    }
    // pane: the SAME reflective rim with NO bend
    for (const [id, dim] of [
      ['pane', token('--lens-dim')!],
      ['pane-dark', token('--lens-dim', darkScope)!],
    ] as const) {
      const f = filt(id);
      expectBoxClip(f, id);
      expect(f).not.toMatch(/feDisplacementMap|displacement_map/); // no bend
      expect(f).toMatch(
        /<feColorMatrix in="SourceGraphic" type="saturate" values="5" result="base_saturated"/,
      );
      expect(f).toMatch(/<feComponentTransfer in="SourceGraphic" result="rgb_dimmed"/);
      expectSpec(f);
      expectDim(f, dim);
    }
    // drop: disc bend + rim, NO dim — one filter serves both themes
    const df = filt('drop');
    expectBoxClip(df, 'drop');
    expect(df).toMatch(/href="\/drop-map\.png"[^>]*result="displacement_map"/);
    expect(df).toMatch(
      /<feDisplacementMap in="SourceGraphic"[^>]*scale="5"[^>]*result="displaced"/,
    );
    expect(df).toMatch(
      new RegExp(`type="saturate" values="${specSat}" result="displaced_saturated"`),
    );
    expect(df).toMatch(/href="\/drop-spec\.png"[^>]*result="specular_layer"/);
    expect(df).not.toMatch(/feFuncR/); // droplets carry no dim
    expect(df).toMatch(`<feFuncA type="linear" slope="${specOpacity}"`);
    expect(df).toMatch(
      /<feBlend in="specular_saturated" in2="displaced" mode="normal" result="withSaturation"/,
    );

    // ── the family rides every structural rule ──
    for (const tier of ['lite', 'off'] as const) {
      expect(css).toMatch(
        new RegExp(
          `:root\\[data-glass='${tier}'\\]\\s+:is\\([\\s\\S]*?\\.lens,[\\s\\S]*?\\.drop,[\\s\\S]*?\\)\\s*\\{\\s*backdrop-filter: none;`,
        ),
      );
    }
    expect(css).toMatch(
      /@supports \(corner-shape: squircle\)\s*\{[\s\S]*?\.lens,[\s\S]*?\.drop\s*\{\s*corner-shape: squircle;/,
    );
  });

  it('dark login token pin exists (white-on-white regression fix)', () => {
    expect(css).toMatch(
      /:root\[data-theme='dark'\] \.login-shell\s*\{[^}]*--color-ink:\s*#1a1a2e/s,
    );
  });
});
