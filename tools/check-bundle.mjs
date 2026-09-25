import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const assetsDir = path.resolve('dist/assets');
const files = (await readdir(assetsDir)).filter((file) => file.endsWith('.js'));
const limits = { chunk: 550 * 1024, entry: 400 * 1024 };
const failures = [];
const report = [];
for (const file of files) {
  const bytes = (await stat(path.join(assetsDir, file))).size;
  const limit = file.startsWith('index-') ? limits.entry : limits.chunk;
  report.push({ file, bytes, limit });
  if (bytes > limit)
    failures.push(
      `${file}: ${(bytes / 1024).toFixed(1)} kB exceeds ${(limit / 1024).toFixed(0)} kB`,
    );
}

console.log('JavaScript chunk sizes (largest first):');
for (const item of report.sort((a, b) => b.bytes - a.bytes)) {
  const percentage = Math.round((item.bytes / item.limit) * 100);
  console.log(
    `  ${item.file.padEnd(42)} ${(item.bytes / 1024).toFixed(1).padStart(7)} kB  ${String(percentage).padStart(3)}% of budget`,
  );
}

if (failures.length) {
  console.error('Bundle budget failed:\n' + failures.join('\n'));
  process.exit(1);
}
console.log(`Bundle budget passed for ${files.length} JavaScript chunks.`);
