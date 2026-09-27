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

  it('light: resting shadow stays subtle (a <= 0.14, was 0.20)', () => {
    const v = token('--glass-sh-a', ':root');
    expect(v).not.toBeNull();
    expect(parseFloat(v!)).toBeLessThanOrEqual(0.14);
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

  it('rim carries chromatic dispersion (tinted edges, not neutral white)', () => {
    expect(css).toMatch(/--glass-edge-tint-top:\s*205 236 255/);
    expect(css).toMatch(/--glass-edge-tint-bot:\s*168 244 234/);
  });

  it('lens band exists with its own sharper blur chain', () => {
    expect(css).toMatch(/\.glass-edge:not\(\.glx-sheen\)::after\s*\{[^}]*backdrop-filter/s);
    const t = token('--glass-lens-t');
    expect(t).not.toBeNull();
    expect(parseFloat(t!)).toBeGreaterThanOrEqual(8);
    expect(parseFloat(t!)).toBeLessThanOrEqual(14);
  });

  it('lens band is stripped in lite/off tiers (surface discipline)', () => {
    expect(css).toMatch(/:root\[data-glass='lite'\] \.glass-edge::after\s*\{\s*backdrop-filter:\s*none;/);
    expect(css).toMatch(/:root\[data-glass='off'\] \.glass-edge::after\s*\{\s*backdrop-filter:\s*none;/);
  });

  it('refraction filter #lg-lens is actually defined (feDisplacementMap)', () => {
    expect(html).toMatch(/id="lg-lens"/);
    expect(html).toMatch(/feDisplacementMap/);
    expect(html).toMatch(/feImage/);
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
