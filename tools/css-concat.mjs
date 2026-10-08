/**
 * CSS concat helper — returns the full bundled text of the src/styles/ chain
 * in @import order. Gates that assert on flat CSS text (check-contrast,
 * check-glass-discipline) and static contract tests read through here so the
 * styles/ split stays invisible to them.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('../', import.meta.url)), '.');

export const CSS_CHAIN = [
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

export function readBundledCss() {
  return CSS_CHAIN.map((rel) => readFileSync(join(root, rel), 'utf8')).join('\n');
}
