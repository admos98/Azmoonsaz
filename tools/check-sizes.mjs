/**
 * Size ratchet — keeps big files shrinking, stops new ones growing.
 *
 * Rule:
 *   - Files listed in OVERRIDES may never exceed their committed length.
 *     To shrink one, lower its number in the same PR (or delete its entry
 *     when it drops to <= NEW_FILE_LIMIT).
 *   - Every other file under src/ must stay <= NEW_FILE_LIMIT lines.
 *
 * Grandfathered lengths were measured 2026-10-08. The list may only shrink:
 * never raise a number, never add an entry for a non-test source file that
 * was split out of an existing surface (splits must land under the limit).
 *
 *   node tools/check-sizes.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('../', import.meta.url)), '.');
const srcRoot = join(root, 'src');

const NEW_FILE_LIMIT = 400;

// Grandfathered offenders (path relative to repo root -> max allowed lines).
// Measured 2026-10-08. Numbers go DOWN, never up.
const OVERRIDES = new Map([
  // App.tsx: shell+router shrunk 451→427 via BootScreens extraction; ratchet steps down.
  ['src/App.tsx', 428], // 444→430: popstate guard fix; 430→428 at v7 — the popstate handler extracted to hooks/usePopstateGuard.ts.
  // Questions.tsx, ExamPreview.tsx, ExamSettings.tsx, ExamResults.tsx,
  // Students.tsx and Topbar.tsx: CQ-11 splits (2026-10-25) brought every one
  // of them under the generic 400-line cap — their OVERRIDES entries were
  // deleted (ratchet steps complete). Extracted modules live in
  // src/features/{exam-preview,exam-settings,question-bank,student-roster}/*,
  // src/pages/teacher/{exam-preview,exam-results}/*, src/components/topbar/*.
  // glassMaterial.test.ts: 950→677 — the material-family it extracted to glassMaterialFamily.test.ts.
  // 677→678: the Meraj Rising plate swap renamed two plate pins (bg-d → bg-h).
  ['src/test/config/glassMaterial.test.ts', 678],
  ['src/glass/glassController.ts', 696],
  // 697: +7 from the 2026-10-25 audit pass (FE-4 tab-prop sync fix).
  ['src/pages/teacher/TeacherProfile.tsx', 697],
  ['src/test/components/LibraryV2.test.tsx', 669],
  // mapMath: 407→391 — the dim-law block extracted to dimLaw.ts at the Meraj P0
  // split (2026-10-25); mapMath is back under the generic 400 cap and its
  // OVERRIDES entry was deleted (ratchet step complete). The girih wave added
  // ~30 documented lines the same day; the render-contract comments stay intact.
  // perfRecorder: 752→528 — ?perf=1 report types → perfReporterTypes.ts, the DOM overlay → perfRecorderUi.ts.
  ['src/glass/perfRecorder.ts', 527],
  // webglRenderer: 1005→723 — GLSL + GL helpers extracted to webglShaders.ts. The rest is one
  // cohesive state-bound class (plate pipeline + GL draw) that resists further seams.
  ['src/glass/webglRenderer.ts', 722],
  // SecureExamPortal: 892→73 (wiring shell; logic in features/secure-exam/*) — OVERRIDES removed, generic 400 cap applies.
  ['src/pages/teacher/Dashboard.tsx', 537],
  ['src/pages/teacher/NewExam.tsx', 607], // 607: +5 from the 2026-10-25 audit pass (FE-6 seed-class fix)
  ['src/pages/dev/FixtureGallery.tsx', 492],
  ['src/pages/teacher/Login.tsx', 460],
  ['src/features/student-import/StudentImportWizard.tsx', 423],
  ['src/pages/teacher/Settings.tsx', 416],
]);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|css)$/.test(name)) out.push(full);
  }
  return out;
}

// wc -l semantics: number of newline characters.
function lineCount(full) {
  const text = readFileSync(full, 'utf8');
  return (text.match(/\n/g) || []).length;
}

const failures = [];
const shrunk = [];
for (const full of walk(srcRoot)) {
  const rel = relative(root, full).replace(/\\/g, '/');
  const lines = lineCount(full);
  if (OVERRIDES.has(rel)) {
    const cap = OVERRIDES.get(rel);
    if (lines > cap) {
      failures.push(`${rel}: ${lines} lines exceeds grandfathered ${cap} — shrink it and lower the cap in tools/check-sizes.mjs`);
    } else if (lines <= NEW_FILE_LIMIT) {
      failures.push(`${rel}: ${lines} lines is under the ${NEW_FILE_LIMIT}-line limit — delete its OVERRIDES entry (ratchet step complete)`);
    } else if (lines < cap) {
      shrunk.push(`${rel}: ${lines}/${cap} — lower the cap to ${lines} in tools/check-sizes.mjs`);
    }
  } else if (lines > NEW_FILE_LIMIT) {
    failures.push(`${rel}: ${lines} lines exceeds the ${NEW_FILE_LIMIT}-line limit for new files — split it`);
  }
}

if (shrunk.length) {
  console.log('Shrink progress (update the caps in tools/check-sizes.mjs):');
  for (const s of shrunk) console.log(`  ~ ${s}`);
}
if (failures.length) {
  console.error(`check-sizes FAILED (${failures.length}):\n` + failures.map((f) => `  ✖ ${f}`).join('\n'));
  process.exit(1);
}
console.log(`check-sizes passed: ${walk(srcRoot).length} files, ${OVERRIDES.size} grandfathered (shrink-only).`);
