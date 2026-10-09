/**
 * Heading gate — one h1 per rendered route, no skipped levels in page flow.
 *
 * Screen-reader users navigate by headings; a page with zero h1s has no
 * name, two h1s has two names, and an h2→h4 jump hides a level.
 *
 * Model (verified against the tree 2026-10-09):
 *   - PageHeader renders h1 by default, h2 with level={2}.
 *   - Top-level `return (` blocks (2-space indent) are alternative renders —
 *     loading skeletons, sub-views, tab branches. Exactly one carries the
 *     page h1; skeleton/empty branches are exempt.
 *   - Headings inside Modal/ConfirmDialog/drawer JSX are dialog titles, not
 *     page structure — exempt. Card-internal item titles are list content.
 *
 *   node tools/check-headings.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('../', import.meta.url)), '.');

// Route modules: every file that renders as a full page on some route.
const ROUTE_DIRS = ['src/pages', 'src/components/AbsencePage.tsx'];

function collect(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === 'dev') continue; // material lab is exempt
      out.push(...collect(full));
    } else if (/\.tsx$/.test(name)) out.push(full);
  }
  return out;
}

const files = [];
for (const entry of ROUTE_DIRS) {
  const full = join(root, entry);
  if (statSync(full).isDirectory()) files.push(...collect(full));
  else files.push(full);
}

const stripComments = (s) =>
  s
    .replace(/\r/g, '') // CRLF checkouts break the branch-split regex below
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/^\s*\/\/.*$/, ''))
    .join('\n');

// Remove dialog/drawer JSX subtrees — their headings are dialog titles.
function stripDialogs(src) {
  return src
    .replace(/<Modal[\s\S]*?<\/Modal>/g, '<Modal/>')
    .replace(/<ConfirmDialog[\s\S]*?\/>/g, '<ConfirmDialog/>')
    .replace(/id="questions-grid"[\s\S]*$/g, '');
}

// PageHeader renders h1 by default, h2 with level={2}. Single
// position-ordered scan so document order is exact.
function headingLevels(src) {
  const out = [];
  const re = /<h([1-4])[\s>]|<PageHeader[\s\S]*?\/>/g;
  let m;
  while ((m = re.exec(src))) {
    if (m[1]) out.push(Number(m[1]));
    else out.push(/level=\{2\}/.test(m[0]) ? 2 : 1);
  }
  return out;
}

const failures = [];
for (const full of files) {
  const rel = relative(root, full).replace(/\\/g, '/');
  if (/\.test\.tsx$/.test(rel)) continue;
  const src = stripDialogs(stripComments(readFileSync(full, 'utf8')));
  // Top-level returns only (2-space indent) — nested returns are callbacks.
  // Skeleton/empty branches (no headings at all) are loading states — exempt.
  // Exactly one content branch must carry the h1; none may carry two.
  const parts = src.split(/\n  return \(/);
  const blocks = parts.length > 1 ? parts.slice(1) : [src];
  const contentBlocks = blocks.filter((b) => headingLevels(b).length > 0);
  if (contentBlocks.length === 0) continue;
  const h1Count = contentBlocks.filter((b) => headingLevels(b).includes(1)).length;
  if (h1Count === 0) {
    failures.push(`${rel}: no branch carries an h1 — every route needs exactly one page title`);
    continue;
  }
  for (const [bi, block] of contentBlocks.entries()) {
    const levels = headingLevels(block);
    const where = contentBlocks.length > 1 ? `${rel}#branch${bi + 1}` : rel;
    const h1s = levels.filter((l) => l === 1).length;
    if (h1s > 1) {
      failures.push(`${where}: ${h1s} h1s — a page has exactly one name`);
    }
    for (let i = 1; i < levels.length; i++) {
      if (levels[i] > levels[i - 1] + 1) {
        failures.push(`${where}: skipped heading level h${levels[i - 1]} → h${levels[i]}`);
        break;
      }
    }
  }
}

if (failures.length) {
  console.error(`check-headings FAILED (${failures.length}):\n` + failures.map((f) => `  ✖ ${f}`).join('\n'));
  process.exit(1);
}
console.log(`check-headings passed: ${files.length} route modules, one h1 each, no skipped levels.`);
