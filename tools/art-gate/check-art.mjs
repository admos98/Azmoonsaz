/**
 * Art stroke-weight gate — runs tools/art-gate/measure.py (spread ≤ 15%).
 *
 * Every family is measured on its OWN band: the six parents share the legacy
 * motif band, cuts are icon-scale, absence is its own family, and single-file
 * families (seal, hero, neutral) self-check at 0%. One failing band fails
 * the gate — a family that drifts out of the system reads differently at
 * slot size even when its siblings are fine.
 *
 * Skips LOUDLY (exit 0, "SKIP" printed) when python or its deps are not on
 * this machine: regenerations happen on the dev box where pillow/numpy live,
 * and a toolchain-less machine must not brick `npm run gate`. The skip line
 * says exactly how to enable it — a silent skip would rot into theater.
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const root = process.cwd();
const BANDS = [
  ['parents', join(root, 'public/empty-art/light')],
  ['cuts', join(root, 'public/empty-art/cuts/light')],
  ['absence', join(root, 'public/empty-art/absence/light')],
  ['seal', join(root, 'public/empty-art/seal/light')],
  ['hero', join(root, 'public/empty-art/hero/light')],
  ['neutral', join(root, 'public/empty-art/neutral/light')],
];

let failed = false;
for (const [name, dir] of BANDS) {
  const r = spawnSync('python', ['tools/art-gate/measure.py', dir], { encoding: 'utf8', cwd: root });
  if (r.error?.code === 'ENOENT') {
    console.error('SKIP art gate: `python` not on PATH — install python + `python -m pip install pillow numpy` to enable.');
    process.exit(0);
  }
  const err = r.stderr || '';
  if (/ModuleNotFoundError|ImportError/.test(err)) {
    console.error('SKIP art gate: deps missing — `python -m pip install pillow numpy` to enable.');
    process.exit(0);
  }
  if (r.stdout) process.stdout.write(`band ${name}:\n${r.stdout}`);
  if (r.status !== 0) {
    failed = true;
    if (err) process.stderr.write(err);
  }
}
if (failed) {
  console.error('art gate FAILED — stroke-weight spread over 15%. Re-run process.py normalization (see docs/art/Azmoonsaz-ART-MASTERPLAN.md).');
  process.exit(1);
}
