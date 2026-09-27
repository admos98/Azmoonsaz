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

  it('rim is a crisp specular curve — bright top, transparent sides, never blurred', () => {
    // light: specular spike + steep falloff around the perimeter (the "curve")
    expect(token('--glass-edge-base')).toBe('0.9');
    expect(token('--glass-edge-mid-f')).toBe('0.32');
    expect(token('--glass-edge-bot-f')).toBe('0.17');
    // the top-centre light curve that wraps around the corners
    expect(css).toMatch(/140% 90% at 50% 0%/);
    // a blurred line reads as a gray hairline, not light — the rim never blurs
    expect(css).not.toMatch(/filter:\s*blur\(0\.5px\)/);
    // dark keeps its soft sheen (higher side/bottom factors)
    expect(token('--glass-edge-mid-f', ':root[data-theme=\'dark\']')).toBe('0.5');
  });

  it('inner bloom — light spills inside under the top rim (paint-only)', () => {
    expect(token('--glass-bloom-line-a')).toBe('0.34');
    expect(token('--glass-bloom-a')).toBe('0.5');
    expect(token('--glass-bloom-a', ':root[data-theme=\'dark\']')).toBe('0.12');
    expect(css).toMatch(/inset 0 1px 0 rgb\(255 255 255 \/ var\(--glass-bloom-line-a\)\)/);
  });

  it('the lens pull is strong enough to read (scale=20 → max ±10px)', () => {
    expect(html).toMatch(/scale="20"/);
  });

  it('page background carries defined shapes for the glass to reveal and bend', () => {
    const app = readFileSync(join(root, 'src/App.tsx'), 'utf8');
    expect(app).toMatch(/id="app-bg-stage"/);
    // at least 5 low-alpha defined features (rings / discs / bands)
    const shapes = app.match(/rounded-full border-\[\d+px\]|rounded-full bg-\[var\(--color-(?:accent-solid|gold)\)\]\/\d+ blur-\[\d+px\]/g) ?? [];
    expect(shapes.length).toBeGreaterThanOrEqual(5);
  });

  it('rim carries chromatic dispersion (tinted edges, not neutral white)', () => {
    expect(css).toMatch(/--glass-edge-tint-top:\s*205 236 255/);
    expect(css).toMatch(/--glass-edge-tint-bot:\s*168 244 234/);
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
    expect(html).toMatch(/x="-6%"[\s\S]*?width="112%"/);
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
