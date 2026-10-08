/**
 * Library adoption gate — the component-library contract, enforced statically.
 *
 * The 2026-09-27 audit (§5) found a real library that a third of the app
 * ignored: ~201 raw <button>s, ~116 raw fields, 11 hand-rolled overlays,
 * window.confirm on the irreversible exam submit, and two parallel button
 * systems (.btn-soft/.btn-brand). Phase 3 converged the worst offenders and
 * this gate locks the convergence in:
 *
 *   1. NO BROWSER CHROME DIALOGS. `window.confirm(` and `alert(` are banned
 *      in src/pages, src/components and src/features. The designed surfaces
 *      are ConfirmDialog and useToast. Allowlist: hooks/useUnsavedChanges.ts
 *      (the native beforeunload guard is a browser-level API by definition).
 *
 *   2. NO SECOND BUTTON SYSTEM. `.btn-soft` / `.btn-brand` classes are gone;
 *      buttons are library Button variants. Reintroducing them re-forks the
 *      visual language.
 *
 *   3. THE DESIGN SYSTEM NEVER RELOADS. src/ui/* must not call
 *      window.location.reload() — empty states take an onRetry prop.
 *
 *   4. RAW-ELEMENT RATCHET. The counts below are the record for the phase
 *      that introduced this gate. If a change RAISES a count, the gate fails:
 *      new controls must use the library. Lower a baseline in the same commit
 *      that migrates more controls — never raise one to make CI pass.
 *
 * Exit 1 with file:line evidence. Wired into `npm run gate`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('../', import.meta.url)), '.');
const sourceRoot = join(root, 'src');

// Rule 1 — files allowed to call browser chrome dialogs. Keep this SHORT.
const DIALOG_ALLOWLIST = new Set([
  'src/hooks/useUnsavedChanges.ts', // native beforeunload + navigation bypass
]);

// Rule 4 — ratchet baselines (Phase 3a, commit: "feat(phase-3): library v2";
// tightened in Phase 3b after overlay + field convergence).
// Format: { pattern: count }. Only LOWER these numbers over time.
// Known deliberate native exceptions: inline cell-editors inside composite
// editor rows, file/date/time inputs, radio groups, TeacherProfile schedule
// pickers, Topbar/CommandPalette popover chrome.
const RATCHET = {
  // 134 at 3b4 + 6 in phase-4: Topbar div[role=button] -> semantic <button>.
  // A11y-mandated semantic upgrades may raise the count; the 6 are popover
  // chrome awaiting a Menu primitive, not library regressions.
  // 140 -> 76: F-6 migration to TextLink / IconButton / PillButton moved 63
  // raw buttons into the library (2026-10-04). Lower in the migrating
  // commit; never raise to pass CI.
  button: 76, // <button in src/pages + src/components (excl. src/ui) + src/features
  input: 40,
  select: 2,
  textarea: 1,
};

// Rule 5 — per-CATEGORY ratchet for raw buttons. The overall 140 ceiling can
// be gamed by growth in one shape offset by shrink in another; each bucket
// holds its own line. Categories (deterministic, className-based):
//   onSystem     raw <button> wearing btn-glass (correct material use)
//   link         text-styled buttons (hover:underline, or text-ink with no
//                rest background and no padding)  -> migrate to TextLink
//   icon         padded, no rest background (hover wash allowed)
//                -> migrate to IconButton
//   pill         rest background or px+py padding -> migrate to PillButton
//   other        hand-rolled shapes with a bespoke reason (absolute badges,
//                conditional template classes) — reviewed case by case
//   unclassified no className at all
// Migration moves a site OFF raw <button> entirely (counts fall); the same
// commit lowers that category's baseline. Never raise one to pass CI.
const CATEGORY_RATCHET = {
  // F-6 migration (2026-10-04): link 22->0, icon 21->1, pill 24->3.
  // Remaining non-onSystem raw buttons are documented exceptions:
  //   icon(1)  PreferenceSelector row — a selectable row, not a button shape
  //   pill(3)  Exams:203 tab + ExamSettings:641/1342 — conditional template
  //            classes that no fixed prop set reproduces
  //   other(1) TeacherProfile wrapper span-style button
  //   unclassified(2) icon-only buttons without className (Topbar chrome)
  onSystem: 69,
  link: 0,
  icon: 1,
  pill: 3,
  other: 1,
  unclassified: 2,
};

/** Text of a raw <button>'s opening tag — quote- and `=>`-aware, so an
 *  `onClick={() => …}` arrow never truncates the scan. */
function openingTag(src, start) {
  let i = start;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      const q = ch;
      i++;
      while (i < src.length && src[i] !== q) {
        if (src[i] === '\\') i++;
        i++;
      }
    } else if (ch === '>' && src[i - 1] !== '=') {
      return src.slice(start, i + 1);
    }
    i++;
  }
  return src.slice(start, start + 1500);
}

function classifyButton(tag) {
  const cls = tag.match(/className=(?:"([^"]*)"|\{`([^`]*)`\})/);
  if (!cls) return 'unclassified';
  const c = (cls[1] || cls[2] || '').replace(/\s+/g, ' ');
  if (c.includes('btn-glass')) return 'onSystem';
  // classes that paint a background AT REST (hover backgrounds removed first)
  const rest = c.replace(/hover:bg-\[[^\]]*\](\/\d+)?/g, '');
  const restBg = /\bbg-\[/.test(rest);
  const padded = /\bp-[0-9]/.test(rest) || (/\bpx-[0-9]/.test(rest) && /\bpy-[0-9]/.test(rest));
  const textInk = /text-\[var\(--color-(?:accent|danger|success|text-tertiary|text-secondary)\)\]/.test(c);
  if (c.includes('hover:underline') || (textInk && !restBg && !padded)) return 'link';
  if (/\bp-[0-9]/.test(rest) && !restBg) return 'icon';
  if (restBg || padded) return 'pill';
  return 'other';
}

const RATCHET_PATTERNS = {
  button: /<button\b/g,
  input: /<input\b/g,
  select: /<select\b/g,
  textarea: /<textarea\b/g,
};

const violations = [];
const ratchetCounts = {};
const categoryCounts = {};
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(tsx|ts)$/.test(name)) files.push(path);
  }
})(sourceRoot);

const isPageOrComponent = (rel) =>
  (rel.startsWith('src/pages/') || rel.startsWith('src/components/') || rel.startsWith('src/features/')) &&
  !rel.startsWith('src/pages/dev/'); // dev-only material lab is exempt
const isLibrary = (rel) => rel.startsWith('src/ui/');
const isTest = (rel) => rel.includes('/test/') || /\.test\./.test(rel);

for (const file of files) {
  const rel = relative(root, file).replaceAll('\\', '/');
  if (isTest(rel)) continue;
  const src = readFileSync(file, 'utf-8');
  const lines = src.split('\n');

  // Rule 1 — browser chrome dialogs
  if (isPageOrComponent(rel) && !DIALOG_ALLOWLIST.has(rel) && !isLibrary(rel)) {
    lines.forEach((line, i) => {
      if (/window\.confirm\(/.test(line) || /(?<![.\w])alert\(/.test(line)) {
        violations.push(`${rel}:${i + 1} — browser chrome dialog (use ConfirmDialog / useToast)`);
      }
    });
  }

  // Rule 2 — second button system
  if (isPageOrComponent(rel) && /\.tsx$/.test(rel)) {
    lines.forEach((line, i) => {
      if (/className="[^"]*\b(btn-soft|btn-brand)\b/.test(line)) {
        violations.push(`${rel}:${i + 1} — .btn-soft/.btn-brand class (use library Button)`);
      }
    });
  }

  // Rule 3 — design system never reloads
  if (isLibrary(rel)) {
    lines.forEach((line, i) => {
      if (/window\.location\.reload\(\)/.test(line)) {
        violations.push(`${rel}:${i + 1} — src/ui calls window.location.reload()`);
      }
    });
  }

  // Rule 4 — raw-element ratchet (pages + components + features, lib excluded)
  if (isPageOrComponent(rel) && !isLibrary(rel) && /\.tsx$/.test(rel)) {
    for (const [key, rx] of Object.entries(RATCHET_PATTERNS)) {
      const n = (src.match(rx) || []).length;
      if (n > 0) ratchetCounts[key] = (ratchetCounts[key] || 0) + n;
    }
    // Rule 5 — per-category tally for raw buttons (same scope as above)
    for (const m of src.matchAll(/<button\b/g)) {
      const cat = classifyButton(openingTag(src, m.index));
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }
  }
}

// ratchet check against baselines
for (const [key, baseline] of Object.entries(RATCHET)) {
  const actual = ratchetCounts[key] ?? 0;
  if (actual > baseline) {
    violations.push(
      `ratchet ${key}: ${actual} > baseline ${baseline} — new raw <${key}> elements are banned; use the library (src/ui)`
    );
  }
}

// per-category ratchet check (rule 5)
for (const [cat, baseline] of Object.entries(CATEGORY_RATCHET)) {
  const actual = categoryCounts[cat] || 0;
  if (actual > baseline) {
    violations.push(
      `ratchet button/${cat}: ${actual} > baseline ${baseline} — use the matching primitive ` +
        `(TextLink / IconButton / PillButton in src/ui) or Button`
    );
  }
}

if (violations.length > 0) {
  console.error('✗ Library adoption gate failed:\n');
  for (const v of violations) console.error('  ' + v);
  console.error(
    '\nRules: no window.confirm/alert outside allowlist · no .btn-soft/.btn-brand · ' +
      'no reload() in src/ui · raw <button>/<input>/<select>/<textarea> counts may not rise.'
  );
  process.exit(1);
}

console.log(
  'Library adoption check passed: no browser dialogs, one button system, ratchet held at ' +
    Object.entries(RATCHET)
      .map(([k, v]) => `${k}≤${v}`)
      .join(', ') +
    '; raw-button categories ' +
    Object.entries(CATEGORY_RATCHET)
      .map(([k, v]) => `${k}≤${v} (now ${categoryCounts[k] || 0})`)
      .join(', ') +
    '.'
);
