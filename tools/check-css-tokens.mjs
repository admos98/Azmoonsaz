/**
 * CSS token integrity gate.
 *
 * The audit (2026-09-27, findings F1/F2) found the app-wide focus ring styled
 * by a token that was NEVER defined (`--color-focus-ring`), and the body font
 * size silently living in a fallback (`--font-size-base`). Both bugs were
 * invisible: CSS custom properties fail silently at runtime.
 *
 * This gate makes that bug class impossible to reintroduce:
 *   - Collects every custom-property DEFINITION in src/**\/*.{css,tsx,ts}
 *     (`--x: value` patterns, incl. @theme blocks, :root, inline styles).
 *   - Collects every REFERENCE (`var(--x ...)`).
 *   - Fails on any reference with no definition, minus a small documented
 *     allowlist (browser-internal / third-party-injected names).
 *
 * Exit 1 with a file:line report. Wired into `npm run gate`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('../', import.meta.url)), '.');
const sourceRoot = join(root, 'src');

// Names we reference but define outside src (documented, not drift):
const ALLOWLIST = new Set([
  // Bubble-loader stagger index — set inline per bubble
  // (BubbleLoader.tsx style={{ '--i': i }}), consumed by
  // animation-delay: calc(var(--i) * 180ms) in index.css.
  '--i',
  // Runtime-set by useEdgeLight.ts via style.setProperty on each glass
  // surface. Referenced only WITH fallbacks, so pre-pointer paint is correct.
  '--eg-x',
  '--eg-y',
  '--eg-boost',
  // Tailwind v4 injects its internals at runtime; we may reference them.
  '--tw-blur',
  '--tw-brightness',
  '--tw-contrast',
  '--tw-grayscale',
  '--tw-hue-rotate',
  '--tw-invert',
  '--tw-saturate',
  '--tw-sepia',
  '--tw-drop-shadow',
  '--tw-ring-offset-shadow',
  '--tw-ring-shadow',
  '--tw-ring-inset',
  '--tw-shadow',
  '--tw-shadow-colored',
  '--tw-translate-x',
  '--tw-translate-y',
  '--tw-rotate',
  '--tw-skew-x',
  '--tw-skew-y',
  '--tw-scale-x',
  '--tw-scale-y',
]);

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(css|tsx|ts)$/.test(name)) files.push(path);
  }
})(sourceRoot);

const defRe = /(^|[\s;{])((?:--)[a-zA-Z][\w-]*)\s*:/g;
const refRe = /var\(\s*(--[a-zA-Z][\w-]*)/g;
// V5 radius ratchet: raw px radius (css) and arbitrary rounded-[…] (tsx)
// are how ad-hoc shape values creep in. The scale is the --radius-*
// tokens (sm 8 / md 12 / lg 16 / xl 20 / 2xl 24 / 3xl 32 / full);
// border-radius: 50% (circles) stays legal.
const rawRadiusRe = /border-radius:\s*(\d+)px/g;
const arbRadiusRe = /rounded-\[([^\]]*)\]/g;

const defined = new Map(); // name -> first "file:line"
const referenced = new Map(); // name -> [{where}]
const rawRadius = [];

for (const path of files) {
  const rel = relative(root, path);
  const lines = readFileSync(path, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const m of line.matchAll(defRe)) {
      const name = m[2];
      if (!defined.has(name)) defined.set(name, `${rel}:${i + 1}`);
    }
    for (const m of line.matchAll(refRe)) {
      const name = m[1];
      if (!referenced.has(name)) referenced.set(name, []);
      referenced.get(name).push(`${rel}:${i + 1}`);
    }
    if (path.endsWith('.css')) {
      for (const m of line.matchAll(rawRadiusRe))
        rawRadius.push(`${rel}:${i + 1}  border-radius: ${m[1]}px`);
    } else if (path.endsWith('.tsx')) {
      for (const m of line.matchAll(arbRadiusRe)) {
        if (!m[1].includes('var(')) rawRadius.push(`${rel}:${i + 1}  rounded-[${m[1]}]`);
      }
    }
  });
}

const phantoms = [];
for (const [name, sites] of referenced) {
  if (defined.has(name) || ALLOWLIST.has(name)) continue;
  phantoms.push(`${name}\n    referenced at: ${sites.slice(0, 4).join(', ')}${sites.length > 4 ? ` (+${sites.length - 4} more)` : ''}\n    defined at:   NOWHERE`);
}

// Also surface dead tokens (defined, never referenced). Advisory by default
// is history: as of 2026-10-05 the count is ratcheted — deleting a token may
// be intentional staging, but the pile may never GROW (F-7).
const dead = [];
for (const [name, where] of defined) {
  if (!referenced.has(name) && !name.startsWith('--spacing') && !name.startsWith('--radius') && !name.startsWith('--text')) {
    dead.push(`${name}  (defined at ${where})`);
  }
}
const DEAD_TOKEN_BASELINE = 35; // 2026-10-09 dead-token sweep (43 → 35) — only down from here

if (rawRadius.length) {
  console.error(`\u2717 Radius ratchet FAILED: ${rawRadius.length} raw radius value(s) — use the --radius-* tokens:\n`);
  rawRadius.forEach((r) => console.log(`  - ${r}`));
  console.error('\nScale: --radius-sm 8 / md 12 / lg 16 / xl 20 / 2xl 24 / 3xl 32 / full. border-radius: 50% (circles) stays legal.');
  process.exit(1);
}

if (phantoms.length) {
  console.error(`\u2717 Token integrity check FAILED: ${phantoms.length} referenced token(s) are never defined:\n`);
  console.error(phantoms.join('\n\n'));
  console.error('\nDefine the token in the @theme block of src/index.css, fix the reference, or add it to the ALLOWLIST with a comment explaining why it lives outside src/.');
  process.exit(1);
}

if (dead.length > DEAD_TOKEN_BASELINE) {
  console.error(`\u2717 Dead-token ratchet: ${dead.length} unreferenced token(s) exceed the baseline of ${DEAD_TOKEN_BASELINE}.\n  New tokens must be referenced where they are defined — the pile only shrinks:\n`);
  dead.forEach((d) => console.log(`  - ${d}`));
  process.exit(1);
}

if (dead.length) {
  console.log(`Token integrity check passed. ${dead.length} unreferenced token(s) remain (ratchet baseline ${DEAD_TOKEN_BASELINE}, only down):`);
  dead.forEach((d) => console.log(`  - ${d}`));
} else {
  console.log('Token integrity check passed: every referenced token is defined.');
}
