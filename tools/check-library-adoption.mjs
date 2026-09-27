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
 *   3. THE DESIGN SYSTEM NEVER RELOADS. UIComponents must not call
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
  button: 140, // <button in src/pages + src/components (excl. UIComponents) + src/features
  input: 40,
  select: 2,
  textarea: 1,
};

const RATCHET_PATTERNS = {
  button: /<button\b/g,
  input: /<input\b/g,
  select: /<select\b/g,
  textarea: /<textarea\b/g,
};

const violations = [];
const ratchetCounts = {};
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
const isLibrary = (rel) => rel === 'src/components/UIComponents.tsx';
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
        violations.push(`${rel}:${i + 1} — UIComponents calls window.location.reload()`);
      }
    });
  }

  // Rule 4 — raw-element ratchet (pages + components + features, lib excluded)
  if (isPageOrComponent(rel) && !isLibrary(rel) && /\.tsx$/.test(rel)) {
    for (const [key, rx] of Object.entries(RATCHET_PATTERNS)) {
      const n = (src.match(rx) || []).length;
      if (n > 0) ratchetCounts[key] = (ratchetCounts[key] || 0) + n;
    }
  }
}

// ratchet check against baselines
for (const [key, baseline] of Object.entries(RATCHET)) {
  const actual = ratchetCounts[key] ?? 0;
  if (actual > baseline) {
    violations.push(
      `ratchet ${key}: ${actual} > baseline ${baseline} — new raw <${key}> elements are banned; use the library (UIComponents)`
    );
  }
}

if (violations.length > 0) {
  console.error('✗ Library adoption gate failed:\n');
  for (const v of violations) console.error('  ' + v);
  console.error(
    '\nRules: no window.confirm/alert outside allowlist · no .btn-soft/.btn-brand · ' +
      'no reload() in UIComponents · raw <button>/<input>/<select>/<textarea> counts may not rise.'
  );
  process.exit(1);
}

console.log(
  'Library adoption check passed: no browser dialogs, one button system, ratchet held at ' +
    Object.entries(RATCHET)
      .map(([k, v]) => `${k}≤${v}`)
      .join(', ') +
    '.'
);
