/**
 * Glass discipline gate — the material budget, enforced statically.
 *
 * The 2026-09-27 audit found the liquid glass optically beautiful but
 * physically unbudgeted: ~27-30 simultaneous backdrop-filter surfaces on an
 * idle Dashboard, ~120-160 on the ExamResults grading view, refraction
 * applied where it was invisible or animated. The rules below encode the
 * surface-discipline contract so it cannot silently erode:
 *
 *   1. REFRACTION WHITELIST. `glx-refract` may appear only in files listed in
 *      REFRACT_ALLOWLIST. Today: none (every former member animated its size
 *      or bent invisible pixels). Reintroduce deliberately, one file, one
 *      review.
 *
 *   2. NO INLINE BACKDROP-FILTER IN TSX. Every blur belongs to a named
 *      utility in index.css so the tier system (data-glass) can cheapen the
 *      material in one place. Exception: Tailwind's own `backdrop-blur-*`
 *      utilities are also refused — same reason. (Decorative `blur-[..]`
 *      on non-glass elements is `filter`, not `backdrop-filter` — allowed.)
 *
 *   3. glx-inset STAYS BLUR-FREE. It is the control/inner material. If it
 *      ever carries backdrop-filter again, ExamResults returns to ~160
 *      filtered surfaces. Enforced against index.css itself.
 *
 * Exit 1 with file:line evidence. Wired into `npm run gate`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('../', import.meta.url)), '.');
const sourceRoot = join(root, 'src');

// Rule 1 — files where `glx-refract` is allowed. Keep this list SHORT and
// reviewed. An empty list is a healthy list.
//
// 2026-09-27 — the Topbar entry is deliberate. The user asked for the light
// bend on the menu, the notifications panel and the topbar buttons. Those
// surfaces animate `transform: scale(0)→1` (menu panels) or their own width
// (search / profile pills), and a `backdrop-filter: url()` displacement map is
// resampled in the element's local space — so it is wrong on every frame of
// an in-flight transform. They therefore do NOT use `glx-refract`. They use
// `data-lens`, which Topbar sets only once the panel has settled, so the bend
// is never seen on a moving surface. See the `data-lens` rules in index.css.
//
// `glx-refract` itself remains unused: a static bend on a static surface is
// still the most expensive thing in the material, and nothing currently needs
// it badly enough to pay for.
const REFRACT_ALLOWLIST = new Set([
  // 'src/components/Topbar.tsx',  ← example shape; uncomment with a PR note
]);

// Rule 1b — `data-lens` is the SETTLED-state refraction mechanism. It is only
// legitimate on a surface that is static once armed, so it is allowed in a
// small reviewed set of files (same argument as REFRACT_ALLOWLIST, different
// mechanism: Topbar gates the attribute on animation completion).
const LENS_ALLOWLIST = new Set(['src/components/Topbar.tsx']);

// Rule 2 — allowlist for inline backdrop-filter in TSX (should stay empty).
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
    if (line.includes('glx-refract') && !REFRACT_ALLOWLIST.has(rel)) {
      violations.push(`[refract-whitelist] ${rel}:${i + 1} uses glx-refract; add to REFRACT_ALLOWLIST with a review note or remove it.`);
    }
    if (line.includes('data-lens') && !LENS_ALLOWLIST.has(rel)) {
      violations.push(`[lens-whitelist] ${rel}:${i + 1} uses data-lens; add to LENS_ALLOWLIST with a review note or remove it.`);
    }
    if (/(?:style=\{[^}]*|className="[^"]*)backdrop-filter|backdrop-blur-/.test(rawLine) && !INLINE_BF_ALLOWLIST.has(rel)) {
      violations.push(`[inline-backdrop-filter] ${rel}:${i + 1} — blur must live in a named utility in index.css (tier system must control it).`);
    }
  });
}

// Rule 3 — glx-inset must never carry backdrop-filter.
const css = readFileSync(join(root, 'src/index.css'), 'utf8');
const insetBlock = css.match(/@utility glx-inset \{([\s\S]*?)\n\}/);
if (insetBlock && insetBlock[1].includes('backdrop-filter')) {
  violations.push('[inset-blur] src/index.css — @utility glx-inset gained a backdrop-filter. It is the control material; blur there multiplies across every input, badge and row. Move the surface to .glx instead.');
}

if (violations.length) {
  console.error(`\u2717 Glass discipline check FAILED (${violations.length}):`);
  console.error(violations.map((v) => `  - ${v}`).join('\n'));
  process.exit(1);
}
console.log('Glass discipline check passed: refraction whitelist respected, settled-lens whitelist respected, no inline backdrop-filter, inset material blur-free.');
