import fs from 'node:fs';
import path from 'node:path';
import { loadLocalEnv, maskSecret } from './env.mjs';

loadLocalEnv();

const required = [
  'VITE_APP_URL',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STUDENT_ID_PEPPER',
  'APP_URL',
];

let ok = true;
console.log('Deployment readiness check:');
for (const key of required) {
  const value = process.env[key] || '';
  const valid = key === 'STUDENT_ID_PEPPER' ? value.length >= 32 : value.length > 0;
  if (!valid) ok = false;
  const secret = !key.startsWith('VITE_') || key.includes('KEY');
  console.log((valid ? 'OK   ' : 'MISS ') + key + ' = ' + (secret ? maskSecret(value) : value));
}

const envLocal = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocal)) console.log('OK   .env.local exists locally and should not be committed.');

const forbiddenTracked = ['supabase/seed-demo.generated.sql', 'project-dump.txt', 'project-tree.txt'];
for (const file of forbiddenTracked) {
  if (fs.existsSync(path.join(process.cwd(), file))) {
    console.warn('WARN generated/local file exists: ' + file + ' (ensure it is ignored/not committed)');
  }
}

if ((process.env.VITE_ENABLE_MOCK_MODE || '').toLowerCase() === 'true') {
  console.error('FAIL VITE_ENABLE_MOCK_MODE=true. Production must use false.');
  ok = false;
}

if (!ok) process.exit(1);
console.log('Deployment readiness check passed.');
