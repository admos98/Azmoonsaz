/**
 * Contrast gate — asserts RENDERED outcomes, not structural discipline.
 *
 * Every other gate checks that a token is used or a class resolves; none
 * checks that the colour actually reads. This one computes WCAG 2.2 ratios
 * from the token hexes in src/index.css for both themes and fails below
 * threshold. It would have caught F-1 (focus ring at 1.43:1 on light) and
 * F-2 (tertiary drifting below 3:1) pre-ship.
 *
 * Channels asserted (both themes):
 *   text tiers   primary / secondary >= 4.5:1 (AA body) on page-bg + surface
 *                tertiary           >= 3.0:1 (non-essential hint tier)
 *   focus ring   >= 3.0:1 (WCAG 1.4.11 non-text) composited over its ground
 *   status text  success/warning/danger/info >= 4.5:1 on surface
 *   on-solid     white on solid fills (accent/success/danger) >= 4.5:1
 *
 * Plus the F-2 size policy as a ratchet: tertiary at sub-14px roles
 * (text-micro/text-caption) is allowed to EXIST at its current count but
 * never to grow — new code must not add tiny tertiary text.
 *
 *   node tools/check-contrast.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('../', import.meta.url)), '.');
const css = readFileSync(join(root, 'src', 'index.css'), 'utf8');

/* ── token extraction ─────────────────────────────────────────────────── */
// Selector-scoped, not position-scoped: `.login-shell` legitimately
// re-pins LIGHT text tokens under data-theme=dark (audit 2026-09-27), and a
// flat merge would read those as the dark palette. So: light = every block
// before the dark section that isn't dark-scoped; dark = light + the ONE
// global `:root[data-theme='dark']` block.
const darkIdx = css.indexOf("[data-theme='dark']");
if (darkIdx < 0) throw new Error('check-contrast: dark theme block not found');
const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
const lightFull = noComments.slice(0, noComments.indexOf(":root[data-theme='dark']"));
const darkFull = noComments.slice(noComments.indexOf(":root[data-theme='dark']"));

function blocks(text) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(text))) out.push({ sel: m[1].trim(), body: m[2] });
  return out;
}
function tokensIn(body) {
  const out = new Map();
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)[;}]/g)) out.set(m[1], m[2].trim());
  return out;
}
const light = new Map();
for (const b of blocks(lightFull)) {
  if (b.sel.includes("[data-theme='dark']")) continue;
  for (const [k, v] of tokensIn(b.body)) light.set(k, v);
}
const dark = new Map(light);
for (const b of blocks(darkFull)) {
  if (b.sel !== ":root[data-theme='dark']") continue; // global dark block only
  for (const [k, v] of tokensIn(b.body)) dark.set(k, v);
}

/* ── colour math (WCAG 2.x) ───────────────────────────────────────────── */
function parseColor(value) {
  const v = value.trim();
  let m = v.match(/^#([0-9a-f]{3})$/i);
  if (m) {
    const [r, g, b] = [...m[1]].map((c) => parseInt(c + c, 16));
    return { r, g, b, a: 1 };
  }
  m = v.match(/^#([0-9a-f]{6})$/i);
  if (m) {
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  m = v.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?/i);
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  return null;
}
// composite fg over bg (source-over)
function over(fg, bg) {
  const a = fg.a;
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
    a: 1,
  };
}
function lum({ r, g, b }) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function ratio(a, b) {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/* ── the pairings ─────────────────────────────────────────────────────── */
// [fgToken, bgToken, minRatio, kind] kind: 'text' | 'nontext' (composited)
const PAIRS = [
  ['--color-text-primary', '--color-page-bg', 4.5],
  ['--color-text-primary', '--color-surface', 4.5],
  ['--color-text-secondary', '--color-page-bg', 4.5],
  ['--color-text-secondary', '--color-surface', 4.5],
  ['--color-text-tertiary', '--color-page-bg', 3.0],
  ['--color-text-tertiary', '--color-surface', 3.0],
  ['--color-focus-ring', '--color-page-bg', 3.0],
  ['--color-focus-ring', '--color-surface', 3.0],
  ['--color-success', '--color-surface', 4.5],
  ['--color-warning', '--color-surface', 4.5],
  ['--color-danger', '--color-surface', 4.5],
  ['--color-info', '--color-surface', 4.5],
  ['--color-text-on-solid', '--color-accent-solid', 4.5],
  ['--color-text-on-solid', '--color-success-solid', 4.5],
  ['--color-text-on-solid', '--color-danger-solid', 4.5],
];

const failures = [];
const rows = [];
for (const [themeName, tokens] of [
  ['light', light],
  ['dark', dark],
]) {
  for (const [fgKey, bgKey, min] of PAIRS) {
    const fgRaw = tokens.get(fgKey);
    const bgRaw = tokens.get(bgKey);
    if (!fgRaw || !bgRaw) {
      failures.push(`${themeName}: token missing — ${fgRaw ? bgKey : fgKey}`);
      continue;
    }
    const fg = parseColor(fgRaw);
    const bg = parseColor(bgRaw);
    if (!fg || !bg) {
      failures.push(`${themeName}: unparseable — ${!fg ? fgKey : bgKey} = ${!fg ? fgRaw : bgRaw}`);
      continue;
    }
    // The focus ring (alpha) and any translucent ink composites against
    // its ground; opaque colours compare directly.
    const eff = fg.a < 1 ? over(fg, bg) : fg;
    const r = ratio(eff, bg);
    const ok = r >= min;
    rows.push(
      `${ok ? 'PASS' : 'FAIL'}  ${themeName.padEnd(5)} ${fgKey.replace('--color-', '').padEnd(18)} on ${bgKey.replace('--color-', '').padEnd(14)} ${r.toFixed(2).padStart(6)}:1  (need ${min})`,
    );
    if (!ok) failures.push(`${themeName}: ${fgKey} on ${bgKey} = ${r.toFixed(2)}:1 < ${min}`);
  }
}

/* ── F-2 ratchet: tertiary at sub-14px roles must not grow ────────────── */
// Counted per className string containing BOTH text-tertiary and a
// sub-14px role (text-micro / text-caption, bare or variant-prefixed).
const TERTIARY_MICRO_BASELINE = 182;
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.tsx$/.test(name)) out.push(path);
  }
  return out;
}
let cohost = 0;
for (const file of walk(join(root, 'src'))) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
    const cls = m[1] || m[2] || '';
    if (
      cls.includes('text-tertiary') &&
      /(?<![\w-])text-(micro|caption|xs)\b/.test(cls)
    )
      cohost++;
  }
}
const ratchetOk = cohost <= TERTIARY_MICRO_BASELINE;
rows.push(
  `${ratchetOk ? 'PASS' : 'FAIL'}  ratchet tertiary@sub-14px sites = ${cohost} (baseline ${TERTIARY_MICRO_BASELINE})`,
);
if (!ratchetOk)
  failures.push(
    `F-2 ratchet: ${cohost} tertiary sites at sub-14px roles > baseline ${TERTIARY_MICRO_BASELINE} — new tiny-tertiary text added`,
  );

/* ── report ───────────────────────────────────────────────────────────── */
for (const row of rows) console.log(row);
if (failures.length === 0) {
  console.log('\nContrast check passed: all token pairings meet threshold in both themes.');
  process.exit(0);
}
console.error(`\n${failures.length} contrast failure(s):`);
for (const f of failures) console.error(`  ${f}`);
process.exit(1);
