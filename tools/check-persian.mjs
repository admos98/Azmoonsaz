#!/usr/bin/env node
// V1: Persian copy discipline — ZWNJ, letterforms, digits, punctuation.
//
// Closed-list rules (report first, codemod second):
//   zwnj-prefix     می/نمی join the verb with U+200C, never a space
//   zwnj-suffix     ها/های suffixes join the stem with U+200C, never a space
//   zwnj-ezafe      the هـ-ی connector joins with U+200C, never a space
//   letterform      Arabic ك (U+0643), ي (U+064A), ة (U+0629) never appear
//                   in Persian copy — Persian is ک ی (and ة is only Arabic)
//   digit-indic     Eastern Arabic numerals ٠-٩ (U+0660-0669) are not the
//                   Persian digit set ۰-۹ (U+06F0-06F9)
//   digit-latin     Latin digits inside Persian copy — except code-like
//                   tokens (MATH2026) and example lines (مثال)
//   punct-latin     Latin , ; % inside Persian copy — Persian uses ، ؛ ٪
//                   (same مثال/persian-ok exceptions)
//
// Escape hatch: trailing `// persian-ok` on the line suppresses all rules.
//
// Scope: src/**.{ts,tsx} — production sources only (src/test holds pinned
// fixtures; dev harness is excluded). Strings = quoted literals + JSX text.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SRC = join(root, 'src');
const SKIP_DIRS = new Set(['test', 'dev', 'node_modules']);

const rules = [
  {
    id: 'zwnj-prefix',
    desc: 'می/نمی + space → join with U+200C (می‌رود not می رود)',
    // lookbehind: می inside words (الزامی، علمی، کمی، تمامی) is not the prefix
    re: /(?<![\u0621-\u06FF])(?:نمی|می) [\u0621-\u06FF]/gu,
  },
  {
    id: 'zwnj-suffix',
    desc: 'stem + space + ها → join with U+200C (کتاب‌ها not کتاب ها)',
    re: /[\u0621-\u06FF] ها/gu,
  },
  {
    id: 'zwnj-ezafe',
    desc: 'هـ + space + ی + space → join with U+200C (خانه‌ی not خانه ی)',
    re: /ه ی [\u0621-\u06FF]/gu,
  },
  {
    id: 'letterform',
    desc: 'Arabic letterform in Persian copy — use ک (U+06A9), ی (U+06CC)',
    re: /[\u0643\u064A\u0629]/gu,
  },
  {
    id: 'digit-indic',
    desc: 'Eastern Arabic numeral ٠-٩ — Persian copy uses ۰-۹ (U+06F0-06F9)',
    re: /[\u0660-\u0669]/gu,
  },
];

const faRe = /[\u0600-\u06FF]/; // any Arabic-script char = Persian copy
const codeTokenRe = /[A-Za-z][A-Za-z0-9]*/g; // MATH2026, iPhone15 …
const exampleRe = /مثال|مثلا/; // «مثال: 0012487654» — code samples stay Latin
const latinPunctRe = /[,;%]/g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (name.endsWith('.ts') || name.endsWith('.tsx')) out.push(p);
    else if (!name.includes('.')) walk(p, out);
  }
  return out;
}

/** Quoted string contents + JSX text nodes on one line. */
function candidates(line) {
  const out = [];
  for (const m of line.matchAll(/'([^'\\\n]*)'|"([^"\\\n]*)"|`([^`]*)`/g))
    out.push(m[1] ?? m[2] ?? m[3] ?? '');
  for (const m of line.matchAll(/>([^<>]*)</g)) out.push(m[1]);
  return out.filter((s) => faRe.test(s));
}

const findings = [];
for (const file of walk(SRC)) {
  const rel = relative(root, file).split(sep).join('/');
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (line.includes('persian-ok')) return;
    for (const cand of candidates(line)) {
      for (const rule of rules) {
        rule.re.lastIndex = 0;
        if (rule.re.test(cand)) findings.push({ rule: rule.id, rel, line: i + 1, cand: cand.trim().slice(0, 80) });
      }
      if (!exampleRe.test(cand)) {
        // ${...} interpolations AND JSX {expressions} are CODE — commas/
        // digits there belong to expressions, not copy (2 passes each
        // cover one nesting level)
        let stripped = cand
          .replace(/\$\{[^{}]*\}/g, '')
          .replace(/\$\{[^{}]*\}/g, '')
          .replace(/\{[^{}]*\}/g, '')
          .replace(/\{[^{}]*\}/g, '');
        const noCode = stripped.replace(codeTokenRe, '');
        if (/[0-9]/.test(noCode))
          findings.push({ rule: 'digit-latin', rel, line: i + 1, cand: cand.trim().slice(0, 80) });
        latinPunctRe.lastIndex = 0;
        if (latinPunctRe.test(noCode))
          findings.push({ rule: 'punct-latin', rel, line: i + 1, cand: cand.trim().slice(0, 80) });
      }
    }
  });
}

if (!findings.length) {
  console.log('\u2713 check-persian: ZWNJ/letterform/digit/punctuation discipline held.');
  process.exit(0);
}

const byRule = new Map();
for (const f of findings) {
  if (!byRule.has(f.rule)) byRule.set(f.rule, []);
  byRule.get(f.rule).push(f);
}
console.error(`\u2717 check-persian FAILED: ${findings.length} finding(s)\n`);
for (const [id, list] of byRule) {
  const rule = rules.find((r) => r.id === id);
  console.error(`  ${id} (${list.length}) — ${rule ? rule.desc : 'Latin digits/punctuation in Persian copy'}`);
  for (const f of list.slice(0, 8)) console.error(`    ${f.rel}:${f.line}  «${f.cand}»`);
  if (list.length > 8) console.error(`    … ${list.length - 8} more`);
  console.error('');
}
console.error('Fix: join with U+200C, Persian digits/letters, ،؛ ٪ — or mark the line `// persian-ok`.');
process.exit(1);
