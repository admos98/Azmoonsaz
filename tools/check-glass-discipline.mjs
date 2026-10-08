/**
 * Glass discipline gate — the material budget, enforced statically.
 *
 * The 2026-09-27 audit found the liquid glass optically beautiful but
 * physically unbudgeted: ~27-30 simultaneous backdrop-filter surfaces on an
 * idle Dashboard, ~120-160 on the ExamResults grading view, refraction
 * applied where it was invisible or animated. The build-3 follow-up then
 * shipped a NESTED refraction ring (`.glass-edge::after` with its own
 * backdrop-filter): every panel ran TWO filters, corners tinted away from
 * centres (Δ200), and the panel's own glyphs bent. Scroll fps halved.
 *
 * The rules below encode the surface-discipline contract so it cannot erode:
 *
 *   1. ONE BEND, ON THE PANEL. The lens bend (`url('#lg-lens')`) may ride
 *      ONLY the panel's own backdrop-filter in index.css (.glx, .glx-strong,
 *      .glx-dark, gated to the `full` tier). It must never appear in TSX, and
 *      no nested pseudo-element may carry a second backdrop-filter.
 *
 *   2. NO SETTLE/ARM MACHINERY. `data-lens` / `glx-refract` / `lensIn` are
 *      retired — the bend is static, uniform, and never animates. Their
 *      reappearance is a violation.
 *
 *   3. NO INLINE BACKDROP-FILTER IN TSX. Every blur belongs to a named
 *      utility in index.css so the tier system (data-glass) can cheapen the
 *      material in one place. Exception: Tailwind's own `backdrop-blur-*`
 *      utilities are also refused — same reason. (Decorative `blur-[..]`
 *      on non-glass elements is `filter`, not `backdrop-filter` — allowed.)
 *
 *   4. glx-inset STAYS BLUR-FREE. It is the control/inner material. If it
 *      ever carries backdrop-filter again, ExamResults returns to ~160
 *      filtered surfaces. Enforced against index.css itself.
 *
 *   5. EXACTLY ONE #lg-lens. A duplicate SVG id silently shadows the first
 *      definition for every url() reference in the document.
 *
 * Exit 1 with file:line evidence. Wired into `npm run gate`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readBundledCss } from './css-concat.mjs';

const root = join(fileURLToPath(new URL('../', import.meta.url)), '.');
const sourceRoot = join(root, 'src');

// Rule 1 — `url('#lg-lens')` and every retired alias may appear ONLY in
// index.css. Any TSX occurrence is a violation: the bend is defined once and
// applied by CSS, tier-aware, from a single place. Material-contract tests
// are exempt — they assert the ABSENCE of these strings in CSS/HTML.
const MATERIAL_TEST = /\.test\.(ts|tsx)$/;

// Rule 3 — allowlist for inline backdrop-filter in TSX (should stay empty).
const INLINE_BF_ALLOWLIST = new Set([]);

const violations = [];
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(tsx|ts)$/.test(name)) files.push(path);
  }
})(sourceRoot);

for (const path of files) {
  // `relative()` yields backslashes on Windows and forward slashes elsewhere, so
  // the allowlists below (written with '/', as the repo does everywhere) would
  // never match on Windows and the gate would fail on its own sanctioned files.
  const rel = relative(root, path).split(/[\\/]/).join('/');
  const lines = readFileSync(path, 'utf8').split('\n');
  lines.forEach((rawLine, i) => {
    const line = rawLine.trim();
    // Doc comments may discuss the classes; only real markup/class strings count.
    const isComment =
      line.startsWith('*') || line.startsWith('/*') || line.startsWith('//');
    if (isComment) return;
    if (!MATERIAL_TEST.test(rel) && /(lg-lens|glx-refract|data-lens|lensIn)/.test(line)) {
      violations.push(`[bend-whitelist] ${rel}:${i + 1} — the lens bend is owned by index.css (panel-own backdrop-filter, full tier). '${line.slice(0, 60)}' references it from TSX.`);
    }
    if (/(?:style=\{[^}]*|className="[^"]*)backdrop-filter|backdrop-blur-/.test(rawLine) && !INLINE_BF_ALLOWLIST.has(rel)) {
      violations.push(`[inline-backdrop-filter] ${rel}:${i + 1} — blur must live in a named utility in index.css (tier system must control it).`);
    }
  });
}

// Rule 4 — glx-inset must never carry backdrop-filter.
// styles/ split: assert on the concatenated chain (index.css is an @import shim).
const css = readBundledCss();
const insetBlock = css.match(/@utility glx-inset \{([\s\S]*?)\n\}/);
if (insetBlock && insetBlock[1].includes('backdrop-filter')) {
  violations.push('[inset-blur] src/index.css — @utility glx-inset gained a backdrop-filter. It is the control material; blur there multiplies across every input, badge and row. Move the surface to .glx instead.');
}

// Rule 5 — no nested pseudo-element may carry a second backdrop-filter: the
// build-3 ring regression (two filters per panel, corners ≠ centre, panel
// bending itself) shipped exactly this way.
const ringRule = css.match(/\.glass-edge[^{]*::after\s*\{[^}]*\}/);
if (ringRule && ringRule[0].includes('backdrop-filter')) {
  violations.push('[nested-ring-filter] src/index.css — .glass-edge::after carries a backdrop-filter. One filter per panel, on the panel itself. Painted light on the ring is fine; filtering is not.');
}

// Rule 6 — index.html ships NO static filter markup. The old static #lg-lens
// used an external feImage href (never loads inside a backdrop-filter chain —
// it rendered as a uniform whole-panel shift) and a single pre-baked map
// stretched over every panel size. The runtime engine owns filter creation.
const html = readFileSync(join(root, 'index.html'), 'utf8');
const htmlCode = html.replace(/<!--[\s\S]*?-->/g, ''); // comments may document the history
if (/<filter|feImage|feDisplacementMap|id="lg-lens"/.test(htmlCode)) {
  violations.push('[no-static-filter] index.html — filter markup must not ship statically. The runtime engine (src/glass/glassController.ts) builds shared per-geometry data-URI filters; a static one rendered as a whole-panel shift. See docs/liquid-glass-engine-audit.md.');
}

if (violations.length) {
  console.error(`\u2717 Glass discipline check FAILED (${violations.length}):`);
  console.error(violations.map((v) => `  - ${v}`).join('\n'));
  process.exit(1);
}
console.log('Glass discipline check passed: bend owned by index.css panel chains, no settle machinery, no inline backdrop-filter, inset material blur-free, no static filter markup.');
