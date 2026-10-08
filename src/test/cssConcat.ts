/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

/**
 * CSS concat reader — the full bundled text of the src/styles/ chain in
 * @import order. Static contract tests (glass, art) read through here so
 * the styles/ split stays invisible to them. The node-gate twin lives in
 * tools/css-concat.mjs (vitest can't import outside the project root the
 * same way, so this copy lives under src/test/).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './sourceReader';

const CHAIN = [
  'src/styles/fonts.css',
  'src/styles/tokens.css',
  'src/styles/themes.css',
  'src/styles/base.css',
  'src/styles/glass.css',
  'src/styles/typography.css',
  'src/styles/pages.css',
  'src/styles/materials.css',
  'src/styles/buttons.css',
  'src/styles/exam.css',
];

export function readBundledCss(): string {
  return CHAIN.map((rel) => readFileSync(join(repoRoot, rel), 'utf8')).join('\n');
}
