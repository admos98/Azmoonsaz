/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

/**
 * Shared source reader for static contract tests.
 *
 * Reads repo source files (or every .ts/.tsx inside a directory) with
 * comments stripped, so doc mentions of retired classes don't trip
 * absence gates. Extracted from glassMaterial.test.ts — any static
 * source-assertion suite (glass, art, typography) should reuse this
 * instead of growing its own copy.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const repoRoot = join(__dirname, '../..');

export function component(path: string): string {
  const full = join(repoRoot, path);
  const files =
    existsSync(full) && statSync(full).isDirectory()
      ? readdirSync(full).filter((f) => /\.(tsx|ts)$/.test(f)).map((f) => join(full, f))
      : [full];
  const clean = (s: string) =>
    s
      .replace(/\r/g, '') // autocrlf checkouts are CRLF; // strips need line ends
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .map((l) => l.replace(/^\s*\/\/.*$/, ''))
      .join('\n');
  return files.map((f) => clean(readFileSync(f, 'utf8'))).join('\n');
}
