/**
 * Art stroke-weight gate — runs tools/art-gate/measure.py (spread ≤ 15%).
 *
 * Skips LOUDLY (exit 0, "SKIP" printed) when python or its deps are not on
 * this machine: regenerations happen on the dev box where pillow/numpy live,
 * and a toolchain-less machine must not brick `npm run gate`. The skip line
 * says exactly how to enable it — a silent skip would rot into theater.
 */
import { spawnSync } from 'node:child_process';

const r = spawnSync('python', ['tools/art-gate/measure.py'], { encoding: 'utf8' });

if (r.error?.code === 'ENOENT') {
  console.error('SKIP art gate: `python` not on PATH — install python + `python -m pip install pillow numpy` to enable.');
  process.exit(0);
}
const err = r.stderr || '';
if (/ModuleNotFoundError|ImportError/.test(err)) {
  console.error('SKIP art gate: deps missing — `python -m pip install pillow numpy` to enable.');
  process.exit(0);
}
if (r.stdout) process.stdout.write(r.stdout);
if (r.status !== 0) {
  if (err) process.stderr.write(err);
  console.error('art gate FAILED — stroke-weight spread over 15%. Re-run process.py normalization (see docs/art/Azmoonsaz-ART-MASTERPLAN.md).');
  process.exit(1);
}
