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
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/^\s*\/\/.*$/, ''))
    .join('\n');
}

describe('glass material contract (pixel-audit gates)', () => {
  it('light: panel body blur destroys backdrop shapes (>= 18px, was 6px)', () => {
    const v = token('--glass-p-blur');
    expect(v).not.toBeNull();
    expect(parseFloat(v!)).toBeGreaterThanOrEqual(18);
  });

  it('light: fill is a thin trim, not a veil (a1 <= 0.18, was 0.30)', () => {
    const v = token('--glass-p-a1');
    expect(v).not.toBeNull();
    expect(parseFloat(v!)).toBeLessThanOrEqual(0.18);
  });

  it('light: saturation gain makes blurred color fields richer (>= 1.4)', () => {
    const v = token('--glass-p-sat');
    expect(v).not.toBeNull();
    expect(parseFloat(v!)).toBeGreaterThanOrEqual(1.4);
  });

  it('light: resting shadow is GONE — iOS liquid glass carries none (a == 0)', () => {
    const v = token('--glass-sh-a', ':root');
    expect(v).not.toBeNull();
    expect(parseFloat(v!)).toBe(0);
  });

  it('light: overlay elevation is zero too; dark keeps only a whisper', () => {
    const light = token('--glass-sh-strong-a', ':root');
    expect(parseFloat(light!)).toBe(0);
    const dark = token('--glass-sh-strong-a', ":root[data-theme='dark']");
    expect(parseFloat(dark!)).toBeLessThanOrEqual(0.25);
  });

  it('rim is a hairline (max 1.8px) — the 3.6px build-3 rim read as a border', () => {
    const max = token('--glass-edge-max');
    expect(parseFloat(max!)).toBeLessThanOrEqual(1.8);
    const darkMax = token('--glass-edge-max', ":root[data-theme='dark']");
    expect(parseFloat(darkMax!)).toBeLessThanOrEqual(1.8);
  });

  it('dark: panels lift off the navy floor (p-tint luminance >= 48, was ~35)', () => {
    const v = token('--glass-p-tint', ":root[data-theme='dark']");
    expect(v).not.toBeNull();
    const [r, g, b] = v!.split(/\s+/).map(Number);
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    expect(lum).toBeGreaterThanOrEqual(48);
  });

  it('dark: floor carries the brand navy hue (page bg blue channel >= 32)', () => {
    const v = token('--color-page-bg', ":root[data-theme='dark']");
    expect(v).not.toBeNull();
    const hex = v!.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    expect(b).toBeGreaterThanOrEqual(32); // #171622 → b=34; the old neutral #18161d had b=29
    expect(b).toBeGreaterThan(r); // blue-leaning = navy ink family
  });

  it('dark: fill alpha compensates the luminous tint (a1 >= 0.55)', () => {
    const v = token('--glass-p-a1', ":root[data-theme='dark']");
    expect(v).not.toBeNull();
    expect(parseFloat(v!)).toBeGreaterThanOrEqual(0.55);
  });

  it('rim is additive light (plus-lighter) so the specular never flattens', () => {
    expect(css).toMatch(/\.glass-edge::before\s*\{[^}]*mix-blend-mode:\s*plus-lighter/s);
  });

  it('rim shows the REFRACTED BACKGROUND — no painted perimeter line at all', () => {
    // the only resting paint is the top specular curve; the fixed per-edge
    // tint ring (the "static line with static colour") is gone
    expect(token('--glass-edge-base')).toBe('0.9');
    expect(token('--glass-edge-base', ':root[data-theme=\'dark\']')).toBe('0.3');
    // the top-centre light curve that wraps around the corners stays
    expect(css).toMatch(/140% 90% at 50% 0%/);
    // no fixed tint tokens, no resting linear rim, anywhere
    expect(css).not.toMatch(/--glass-edge-tint-/);
    expect(css).not.toMatch(/glass-edge-mid-f|glass-edge-bot-f/);
    const before = css.match(/\.glass-edge::before\s*\{[^}]*\}/s)![0];
    expect(before).not.toMatch(/linear-gradient\(\s*to bottom/);
    // a blurred line reads as a gray hairline, not light — the rim never blurs
    expect(css).not.toMatch(/filter:\s*blur\(0\.5px\)/);
  });

  it('the rim band stays a hairline and stays CLEAR on sides/bottom', () => {
    const max = token('--glass-edge-max');
    expect(parseFloat(max!)).toBeLessThanOrEqual(1.8);
    const darkMax = token('--glass-edge-max', ':root[data-theme=\'dark\']');
    expect(parseFloat(darkMax!)).toBeLessThanOrEqual(1.8);
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
    // glx-strong keeps its +6% modal fill through derived alphas
    expect(css).toMatch(/--glass-p-fa1:\s*calc\(var\(--glass-p-a1\) \+ 0\.06\)/);
  });

  it('no static hairline: the panel border is transparent in both themes', () => {
    expect(token('--glass-p-ba')).toBe('0');
    expect(token('--glass-p-ba', ':root[data-theme=\'dark\']')).toBe('0');
    // off tier restores a visible border for solid panels
    expect(token('--glass-p-ba', ':root[data-glass=\'off\']')).toBe('0.35');
    // and disables the feather (a solid fill must not have a soft fringe)
    expect(css).toMatch(
      /:root\[data-glass='off'\] \.glass-edge::after\s*\{[^}]*mask-image:\s*none/s,
    );
  });

  it('inner bloom — light spills inside under the top rim (paint-only)', () => {
    expect(token('--glass-bloom-line-a')).toBe('0.34');
    expect(token('--glass-bloom-a')).toBe('0.5');
    expect(token('--glass-bloom-a', ':root[data-theme=\'dark\']')).toBe('0.12');
    expect(css).toMatch(/inset 0 1px 0 rgb\(255 255 255 \/ var\(--glass-bloom-line-a\)\)/);
  });

  it('the lens pull is strong enough to read (scale=28 → max ±14px)', () => {
    expect(html).toMatch(/scale="28"/);
  });

  it('ONE background: the topo page plate — the depth-field stage is gone', () => {
    const app = readFileSync(join(root, 'src/App.tsx'), 'utf8');
    expect(app).not.toMatch(/app-bg-stage/);
    // the plate the user asked for is the only background
    expect(css).toMatch(/--page-plate:\s*url\('~\/backgrounds\/bg-d-(light|dark)\.svg'\)|--page-plate:\s*url\('\/backgrounds\/bg-d-(light|dark)\.svg'\)/);
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

  it('no [data-lens] / lensIn machinery — no backdrop-filter may ever animate', () => {
    expect(css).not.toMatch(/\[data-lens\]/);
    expect(css).not.toMatch(/@keyframes lensIn/);
  });

  it('the bend rides the panel chains (url(#lg-lens) FIRST, then uniform blur)', () => {
    expect(css).toMatch(
      /:root:not\(\[data-glass='lite'\]\):not\(\[data-glass='off'\]\) \.glx\s*\{[^}]*backdrop-filter:\s*url\('#lg-lens'\)\s+blur\(var\(--glass-bg-blur\)\)/,
    );
    expect(css).toMatch(
      /:root:not\(\[data-glass='lite'\]\):not\(\[data-glass='off'\]\) \.glx-strong\s*\{[^}]*backdrop-filter:\s*url\('#lg-lens'\)\s+blur\(var\(--glass-p-blur\)\)/,
    );
  });

  it('refraction filter #lg-lens is defined ONCE, edge-weighted, with overscan region', () => {
    expect(html).toMatch(/id="lg-lens"/);
    expect(html).toMatch(/feDisplacementMap/);
    expect(html).toMatch(/feImage/);
    // grey plateau = edge-weighted map (linear maps displace the whole panel)
    const matches = html.match(/808080/g);
    expect(matches!.length).toBeGreaterThanOrEqual(2);
    // oversized region so rim pixels can sample beyond the box
    expect(html).toMatch(/x="-10%"[\s\S]*?width="120%"/);
    // exactly one definition — a duplicate id silently shadows the first
    expect(html.match(/id="lg-lens"/g)!.length).toBe(1);
  });

  it('glx surfaces carry the text micro-shadow ambient', () => {
    // NOTE: 'text-[s]hadow' is written split so the typography linter does not
    // mistake this CSS assertion for an undeclared typography utility.
    expect(css).toMatch(/text-[s]hadow:\s*0 1px 2px rgb\(var\(--glass-text-ambient\)/);
  });

  it('dark login token pin exists (white-on-white regression fix)', () => {
    expect(css).toMatch(/:root\[data-theme='dark'\] \.login-shell\s*\{[^}]*--color-ink:\s*#1a1a2e/s);
  });
});
