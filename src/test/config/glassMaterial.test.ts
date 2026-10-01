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
    // grain used to ride the feathered fill layer; the glint was retired too
    const after = css.match(/\.glass-edge::after\s*\{[^}]*\}/s)![0];
    expect(after).not.toMatch(/var\(--glass-grain\)/);
    // the diagonal `112deg` glint was also retired — it painted a stripe
    // inside every panel (~+16 lum, measured in crop image_277b16.png)
    expect(after).not.toMatch(/linear-gradient\(\s*112deg/);
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

  it('rim crisp ring scales with panel size but stays hairline (max 2px; 2.2px+ read as a border)', () => {
    // --glass-edge-t is a % of the panel's inline size: chip ~1px, card ~1.9px,
    // hero/topbar clamps to the 2px cap — visible weight ladder, still hairline
    // relative to the surface (2px on a 1300px panel = 0.15% of its width).
    const max = token('--glass-edge-max');
    expect(parseFloat(max!)).toBeLessThanOrEqual(2);
    const darkMax = token('--glass-edge-max', ":root[data-theme='dark']");
    expect(parseFloat(darkMax!)).toBeLessThanOrEqual(2);
    // both themes carry a relative thickness, not a fixed px
    expect(parseFloat(token('--glass-edge-t')!)).toBeGreaterThan(0.2);
    expect(parseFloat(token('--glass-edge-t', ":root[data-theme='dark']")!)).toBeGreaterThan(0.2);
  });

  it('rim luminance ramp: crisp ring + soft fade that melts into the panel', () => {
    // the soft fade rides the unmasked element shadow (masked layers would
    // clip it exactly where it must show)
    expect(css).toMatch(
      /inset 0 0 1[46]px -6px rgb\(var\(--glass-edge-color\) \/ var\(--glass-edge-fade\)\)/,
    );
    const fade = token('--glass-edge-fade');
    expect(parseFloat(fade!)).toBeGreaterThan(0);
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

  it('rim is additive light (plus-lighter) so the specular never flattens', () => {
    expect(css).toMatch(/\.glass-edge::before\s*\{[^}]*mix-blend-mode:\s*plus-lighter/s);
  });

  it('rim shows the REFRACTED BACKGROUND + ONE dominant corner catch + an INK shadow line', () => {
    // the fixed per-edge tint ring (the "static line with static colour") is gone
    expect(token('--glass-edge-base')).toBe('0.42');
    expect(token('--glass-edge-base', ":root[data-theme='dark']")).toBe('0.24');
    // the single top-centre searchlight is retired
    expect(css).not.toMatch(/140% 90% at 50% 0%/);
    // ONE tight dominant corner catch on the ring (Apple: a single light source)
    expect(css).toMatch(/26% 34% at 92% 0%/);
    // + the ink hairline (total internal reflection) on the shadowed side —
    // the white band needs its dark counterpart to read as glass
    expect(css).toMatch(/var\(--glass-edge-ink\) \/ var\(--glass-edge-ink-a\)/);
    expect(token('--glass-edge-ink-a', ':root')).toBe('0.18');
    expect(token('--glass-edge-ink-a', ":root[data-theme='dark']")).toBe('0.06');
    // + the WIDE soft half of the single light glows INSIDE the fill (::after);
    // the echo-corner token is RETIRED (two painted sources read as decoration)
    const after = css.match(/\.glass-edge::after\s*\{[^}]*\}/s)![0];
    expect(after).toMatch(/var\(--glass-corner-a\)/);
    expect(token('--glass-corner-b', ':root')).toBeNull();
    // corner light colour is a token (warm in light, cool in dark), not static white
    expect(token('--glass-edge-corner')).toBe('255 248 231');
    expect(token('--glass-edge-corner', ":root[data-theme='dark']")).toBe('236 242 255');
    // no fixed tint tokens, no resting linear rim, anywhere
    expect(css).not.toMatch(/--glass-edge-tint-/);
    expect(css).not.toMatch(/glass-edge-mid-f|glass-edge-bot-f/);
    const before = css.match(/\.glass-edge::before\s*\{[^}]*\}/s)![0];
    expect(before).not.toMatch(/linear-gradient\(\s*to bottom/);
    // a blurred line reads as a gray hairline, not light — the rim never blurs.
    // Scoped to the rim block: other layers (the hero watermark) legitimately
    // carry their own small blur.
    const rimBlock = css.match(/\.glass-edge::before\s*\{[^}]*\}/)?.[0] ?? '';
    expect(rimBlock).not.toMatch(/filter:\s*blur/);
  });

  it('the rim band stays crisp and stays CLEAR on sides/bottom', () => {
    const max = token('--glass-edge-max');
    expect(parseFloat(max!)).toBeLessThanOrEqual(2.5);
    const darkMax = token('--glass-edge-max', ":root[data-theme='dark']");
    expect(parseFloat(darkMax!)).toBeLessThanOrEqual(2.5);
    // uniform band mask (no directional feather) — sides show the lens output
    expect(css).toMatch(
      /\.glass-edge::before\s*\{[^}]*mask:\s*linear-gradient\(#000 0 0\) content-box,\s*linear-gradient\(#000 0 0\)/s,
    );
  });

  it('panel fill feathers out at the rim so the edge shows bent background', () => {
    const after = css.match(/\.glass-edge::after\s*\{[^}]*\}/s)![0];
    expect(after).toMatch(/z-index:\s*-1/); // above filtered backdrop, below content
    expect(after).toMatch(/mask-composite:\s*intersect/); // 2D feather
    expect(after).not.toMatch(/backdrop-filter/); // paint only — one filter per panel
    expect(token('--glass-fill-fade')).not.toBeNull();
    // the element body is clear so the feather actually reveals the page
    expect(css).toMatch(/\.glass-edge\s*\{\s*background:\s*transparent;/);
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
    // dark feather floor — the rim band must not hand bright backdrop back
    expect(token('--glass-fill-edge', ":root[data-theme='dark']")).toBe('0.7');
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
    // and disables the feather (a solid fill must not have a soft fringe)
    expect(css).toMatch(
      /:root\[data-glass='off'\] \.glass-edge::after\s*\{[^}]*mask-image:\s*none/s,
    );
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
    expect((html.match(/<feDisplacementMap/g) || []).length).toBe(2);
    expect(html).not.toMatch(/feColorMatrix/);
    expect(html).not.toMatch(/operator="arithmetic"/);
    expect(html).not.toMatch(/feBlend/);
    expect((html.match(/<feImage/g) || []).length).toBe(2);
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
      /className="relative glx-strong glass-edge w-full max-w-xl overflow-hidden rounded-3xl"/,
    );
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
    expect(css).toMatch(
      /:root\[data-lens='on'\]:not\(\[data-glass='lite'\]\):not\(\[data-glass='off'\]\) \.glx\s*\{[^}]*backdrop-filter:\s*blur\(var\(--glass-bg-blur\)\)\s+saturate\(var\(--glass-bg-sat\)\)\s+url\('#lg-lens'\)/,
    );
    expect(css).toMatch(
      /:root\[data-lens='on'\]:not\(\[data-glass='lite'\]\):not\(\[data-glass='off'\]\) \.glx-strong\s*\{[^}]*backdrop-filter:\s*blur\(var\(--glass-p-blur\)\)\s+saturate\(var\(--glass-p-sat\)\)\s+url\('#lg-lens'\)/,
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
      /:root:not\(\[data-glass='lite'\]\):not\(\[data-glass='off'\]\)\s+:is\(\.glx, \.glx-strong, \.glx-dark, \.panel-a, \.panel-b\)\s+:is\(\.glx, \.glx-strong, \.glx-dark, \.panel-a, \.panel-b\)\s*\{[^}]*backdrop-filter:\s*none/s,
    );
    expect(css).toMatch(
      /:is\(\.glx, \.glx-strong, \.glx-dark, \.panel-a, \.panel-b\)\s+:is\(\.glx, \.glx-strong, \.glx-dark, \.panel-a, \.panel-b\)\.glass-edge::before\s*\{[^}]*content:\s*none/s,
    );
    // and inset rows no longer ask for a rim in markup
    const ui = component('src/components/UIComponents.tsx');
    expect(ui).toMatch(/glassLayer === 'light' \|\| glassLayer === 'strong' \? 'glass-edge' : ''/);
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

  it('the fill survives at the border — the feather floors, it does not erase', () => {
    // The ::after mask used to bottom out at rgb(0 0 0 / 0), fully erasing the
    // outermost 7-10px of fill on all four sides. Light panels then read as
    // transparent with a ring floating on them. The outermost stop floors at
    // --glass-fill-edge so the edge stays part of the material.
    const after = css.match(/\.glass-edge::after\s*\{[\s\S]*?\n\}/s)![0];
    const mask = after.match(/-webkit-mask-image:[\s\S]*?;/s)![0];
    expect(mask).toMatch(/rgb\(0 0 0 \/ var\(--glass-fill-edge\)\)/);
    // and the floor is a real value in both themes, not zero
    const edge = token('--glass-fill-edge');
    expect(edge).not.toBeNull();
    expect(parseFloat(edge!)).toBeGreaterThan(0);
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

  it('Type A/B are LIBRARY material: shared tokens, composed rim, one lens chain', () => {
    // ── tokens: ONE number drives every panel of the class app-wide ──
    expect(token('--panel-dim')).toBe('0.15'); // light
    expect(token('--panel-dim', ":root[data-theme='dark']")).toBe('0.06');
    // tiers swap TOKENS, never markup: blur goes, the dim carries contrast
    expect(token('--panel-dim', ":root[data-glass='lite']")).toBe('0.32');
    expect(token('--panel-dim', ":root[data-glass='off']")).toBe('0.85');
    expect(token('--panel-dim-tint')).toBe('103 100 112');
    expect(token('--panel-rim')).toBe('0.55');
    expect(token('--panel-rim', ":root[data-theme='dark']")).toBe('0.42');
    expect(token('--panel-a-blur')).toBe('3px');
    expect(token('--panel-b-blur')).toBe('20px');
    expect(token('--panel-b-blur', ":root[data-theme='dark']")).toBe('26px');
    // the deleted second-source tokens must never come back
    for (const dead of [
      '--panel-a-dim-tint',
      '--panel-a-dim-a',
      '--panel-b-dim-a',
      '--panel-a-reflect',
      '--panel-a-rim-bg',
      '--panel-b-rim-bg',
    ]) {
      expect(token(dead)).toBeNull();
    }

    // ── utilities CONSUME tokens; no own paint, no bespoke rim layer ──
    for (const [u, blur] of [
      ['panel-a', '--panel-a-blur'],
      ['panel-b', '--panel-b-blur'],
    ] as const) {
      const util = css.match(new RegExp(`@utility ${u} \\{[\\s\\S]*?\\n\\}`))![0];
      expect(util).toMatch(/--glass-p-fa1: var\(--panel-dim\)/); // dim IS the fill
      expect(util).toMatch(/--glass-p-fa2: var\(--panel-dim\)/);
      expect(util).toMatch(/--glass-p-tint: var\(--panel-dim-tint\)/);
      expect(util).toMatch(/--glass-edge-base: var\(--panel-rim\)/);
      expect(util).toMatch(new RegExp(`--glass-p-blur: var\\(${blur}\\)`));
      expect(util).toMatch(/background: transparent/);
      expect(util).toMatch(/border: 0/);
      expect(util).not.toMatch(/linear-gradient/); // nothing painted by hand
      // additive base: plain blur survives a paint-time url() failure
      expect(util).toMatch(
        new RegExp(
          `backdrop-filter: blur\\(var\\(${blur}\\)\\) saturate\\(var\\(--panel-[ab]-sat\\)\\);`,
        ),
      );
    }
    // the rim lives ONLY in .glass-edge — no .panel-x::before/::after anywhere
    expect(css).not.toMatch(/\.panel-[ab]::before/);
    expect(css).not.toMatch(/\.panel-[ab]::after/);

    // ── ONE backdrop-filter, blur first, bend last, gated like .glx ──
    for (const u of ['panel-a', 'panel-b'] as const) {
      expect(css).toMatch(
        new RegExp(
          `:root\\[data-lens='on'\\]:not\\(\\[data-glass='lite'\\]\\):not\\(\\[data-glass='off'\\]\\) \\.${
            u
          } \\{[^}]*backdrop-filter: blur\\(var\\(--${
            u
          }-blur\\)\\) saturate\\(var\\(--${u}-sat\\)\\)\\s+url\\('#panel-lens'\\)`,
        ),
      );
    }

    // ── the physics lens: ONE definition, box-clipped, scale = the tune ──
    expect(html.match(/id="panel-lens"/g)!.length).toBe(1);
    expect(html).toMatch(/<filter id="panel-lens" x="0" y="0" width="100%" height="100%"/);
    expect(html).not.toMatch(/<filter id="panel-lens" x="-/);
    expect(html).toMatch(/href="\/panel-lens-map\.png"/);
    expect(html).toMatch(/scale="44"/); // ±22px = tuned playground pull
    // the map is a GENERATED artifact (tools/gen-panel-lens.py), checked in
    expect(existsSync(join(root, 'public/panel-lens-map.png'))).toBe(true);

    // ── panels ride the same structural rules as every glass surface ──
    expect(css).toMatch(
      /:root\[data-glass='lite'\]\s+:is\([^)]*\.panel-a, \.panel-b[^)]*\)\s*\{\s*backdrop-filter: none;/,
    );
    expect(css).toMatch(
      /:root\[data-glass='off'\]\s+:is\([^)]*\.panel-a, \.panel-b[^)]*\)\s*\{\s*backdrop-filter: none;/,
    );
    // de-nest: a panel inside a panel flattens (backdrop roots)
    expect(css).toMatch(
      /:is\(\.glx, \.glx-strong, \.glx-dark, \.panel-a, \.panel-b\)\s+:is\(\.glx, \.glx-strong, \.glx-dark, \.panel-a, \.panel-b\)\s*\{[^}]*backdrop-filter:\s*none/s,
    );
    // squircle corners apply to the panel utilities too
    expect(css).toMatch(
      /@supports \(corner-shape: squircle\) \{[\s\S]*?\.panel-a,\s*\.panel-b \{\s*corner-shape: squircle;/,
    );
  });

  it('dark login token pin exists (white-on-white regression fix)', () => {
    expect(css).toMatch(
      /:root\[data-theme='dark'\] \.login-shell\s*\{[^}]*--color-ink:\s*#1a1a2e/s,
    );
  });
});
