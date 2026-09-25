/**
 * Reports typography utilities that are used in TSX but never declared, so they
 * silently emit no CSS at all (a class that looks applied and isn't).
 *
 * Read-only report that FAILS when it finds offenders, so it can gate `npm run
 * check`. It currently passes: the 14 `text-md` sites were cleared in Phase 1.
 *
 *   node tools/check-typography.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('../', import.meta.url)), '.');
const css = readFileSync(join(root, 'src', 'index.css'), 'utf8');

// Roles declared by this design system.
const declared = new Set(
  [...css.matchAll(/@utility\s+(text-[\w-]+)/g)].map((m) => m[1]),
);

// Tailwind's built-in font-size scale.
const builtInSizes = new Set([
  'xs', 'sm', 'base', 'lg', 'xl',
  '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl',
]);

// Theme colours become `text-<name>` utilities too.
const themeColors = new Set([...css.matchAll(/--color-([\w-]+)\s*:/g)].map((m) => m[1]));

// Non-size, non-colour `text-*` utilities Tailwind provides itself.
const alignment = new Set([
  'left', 'right', 'center', 'justify', 'start', 'end',
  'wrap', 'nowrap', 'balance', 'pretty', 'truncate', 'ellipsis', 'clip',
]);

// Generic colour palettes (text-red-500, text-white, text-slate-100 …).
const palette =
  /^(white|black|transparent|current|inherit|gray|red|blue|green|yellow|orange|purple|pink|indigo|teal|cyan|emerald|amber|rose|violet|lime|sky|stone|zinc|neutral|slate)(-\d{2,3})?$/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

const offenders = new Map();
for (const file of walk(join(root, 'src'))) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((raw, i) => {
    // Drop arbitrary values before scanning, otherwise the regex re-matches
    // inside `text-[var(--color-text-secondary)]` and reports a false token.
    const line = raw.replace(/\[[^\]]*\]/g, '[]');
    // Matches `text-md`, `md:text-md`, `hover:text-white/90`, `text-[]`.
    // `(?<![\w-])` so a kebab id like `question-text-box` is not read as a class.
    for (const m of line.matchAll(/(?<![\w-])((?:[\w-]+:)*text-[\w[\]/-]+)/g)) {
      const cls = m[1];
      const bare = cls.slice(cls.lastIndexOf(':') + 1); // strip variant prefixes
      const token = bare
        .slice('text-'.length)
        .replace(/\/\d+$/, ''); // strip opacity suffix, e.g. white/90
      if (token.startsWith('[')) continue; // arbitrary value: text-[1.25rem]
      if (
        declared.has(bare) ||
        builtInSizes.has(token) ||
        alignment.has(token) ||
        themeColors.has(token) ||
        palette.test(token)
      )
        continue;
      const rel = file.slice(root.length + 1).replaceAll('\\', '/');
      offenders.set(`${rel}:${i + 1}`, cls);
    }
  });
}

if (offenders.size === 0) {
  console.log('Typography check passed: every text-* utility resolves to a real rule.');
  process.exit(0);
}

console.error(
  `Typography utilities used but never declared (they render at no size at all):\n`,
);
for (const [where, cls] of offenders) console.error(`  ${where}  ${cls}`);
console.error(
  `\n${offenders.size} site(s). Replace with a declared role: ${[...declared].join(', ')}.`,
);
process.exit(1);
