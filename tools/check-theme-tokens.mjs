import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// .pathname from a file: URL is POSIX-shaped ("/D:/…" on Windows) and resolves
// to a doubled drive letter — fileURLToPath gives a real native path instead.
const root = join(fileURLToPath(new URL('../', import.meta.url)), '.');
const sourceRoot = join(root, 'src');
const violations = [];
const forbidden = [
  /\bbg-(?:white|gray|slate|zinc|neutral|stone)(?:-[0-9]+)?(?:\/[0-9]+)?\b/g,
  /\bborder-(?:black|white|gray|slate|zinc|neutral|stone)(?:-[0-9]+)?(?:\/[0-9]+)?\b/g,
  /\btext-(?:black|white|gray|slate|zinc|neutral|stone)(?:-[0-9]+)?(?:\/[0-9]+)?\b/g,
];

function walk(directory) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(tsx|ts)$/.test(name)) inspect(path);
  }
}

function inspect(path) {
  const lines = readFileSync(path, 'utf8').split('\n');
  lines.forEach((line, index) => {
    for (const pattern of forbidden) {
      pattern.lastIndex = 0;
      for (const match of line.matchAll(pattern)) {
        violations.push(`${relative(root, path)}:${index + 1} ${match[0]}`);
      }
    }
  });
}

walk(sourceRoot);
if (violations.length) {
  console.error('Literal neutral color utilities bypass the light/dark semantic theme:');
  console.error(violations.join('\n'));
  process.exit(1);
}
console.log('Theme token check passed: no literal neutral utility colors in TypeScript UI files.');
