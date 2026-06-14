import fs from 'node:fs';
import path from 'node:path';

const targets = [
  'project-dump.txt',
  'project-tree.txt',
  'supabase/seed-demo.generated.sql',
  'dist',
];

for (const target of targets) {
  const full = path.join(process.cwd(), target);
  if (!fs.existsSync(full)) continue;
  fs.rmSync(full, { recursive: true, force: true });
  console.log('Removed ' + target);
}

console.log('Generated cleanup complete.');
