import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const forbidden = ['SUPABASE_SERVICE_ROLE_KEY=', 'STUDENT_ID_PEPPER=', 'GEMINI_API_KEY=', 'sb_secret_'];
const scanDirs = ['src', 'api', 'docs'];
let failed = false;

function scan(file) {
  const text = fs.readFileSync(file, 'utf8');
  for (const item of forbidden) {
    if (text.includes(item)) {
      console.error('Forbidden secret marker found in ' + file + ': ' + item);
      failed = true;
    }
  }
}

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx|js|mjs|md|json)$/.test(entry.name)) scan(full);
  }
}

for (const dir of scanDirs) walk(path.join(root, dir));

if (fs.existsSync(path.join(root, '.env.local'))) {
  console.log('OK: .env.local exists locally. Make sure it is not committed.');
}

if (failed) process.exit(1);
console.log('Production safety scan passed.');
