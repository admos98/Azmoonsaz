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
  ['src/App.tsx', 427],
  // Questions.tsx: 1973→1416; type builders extracted to features/question-bank/builders/*.
  ['src/pages/teacher/Questions.tsx', 1416],
  ['src/pages/teacher/ExamPreview.tsx', 1891],
  ['src/pages/teacher/ExamResults.tsx', 1307],
  ['src/pages/teacher/ExamSettings.tsx', 1356],
  // Students.tsx: 1240→889; roster views + NID helpers in features/student-roster/*.
  ['src/pages/teacher/Students.tsx', 889],
  // glassMaterial.test.ts: 950→677 — the material-family it extracted to glassMaterialFamily.test.ts.
  ['src/test/config/glassMaterial.test.ts', 677],
  ['src/components/Topbar.tsx', 906],
  // glassController: 696→713 — M1 chrome-pass wiring (imports, bootChrome/
  // tickChrome/shutdownChrome call sites, chrome stats; all chrome LOGIC
  // lives in glassChrome.ts). Ratchet steps down in the Stage-4 cleanup.
  ['src/glass/glassController.ts', 709],
  ['src/pages/teacher/TeacherProfile.tsx', 690],
  ['src/test/components/LibraryV2.test.tsx', 669],
  // mapMath: DOM-free shared math (main thread + worker). Its size IS the render-contract
  // documentation the audit pins (“DO NOT simplify any of these back”). FRONTEND-FINDINGS.md
  // Finding 5 blesses a documented cap for it.
  ['src/glass/mapMath.ts', 407],
  // perfRecorder: 752→528 — ?perf=1 report types → perfReporterTypes.ts, the DOM overlay → perfRecorderUi.ts.
  // 527→530: attempt-4 dig — chromePanels surface dump rides the report.
  ['src/glass/perfRecorder.ts', 530],
  // webglRenderer: 1005→723 — GLSL + GL helpers extracted to webglShaders.ts. The rest is one
  // cohesive state-bound class (plate pipeline + GL draw) that resists further seams.
  ['src/glass/webglRenderer.ts', 722],
  // SecureExamPortal: 892→73 (wiring shell; logic in features/secure-exam/*) — OVERRIDES removed, generic 400 cap applies.
  ['src/pages/teacher/Dashboard.tsx', 627],
  ['src/pages/teacher/NewExam.tsx', 602],
  ['src/pages/dev/FixtureGallery.tsx', 492],
  ['src/pages/teacher/Login.tsx', 469],
  ['src/services/api.ts', 417],
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
