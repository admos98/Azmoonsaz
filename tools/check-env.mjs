import { loadLocalEnv, maskSecret } from './env.mjs';

loadLocalEnv();

const checks = [
  ['VITE_APP_URL', false],
  ['VITE_SUPABASE_URL', false],
  ['VITE_SUPABASE_ANON_KEY', true],
  ['SUPABASE_SERVICE_ROLE_KEY', true],
  ['STUDENT_ID_PEPPER', true],
  ['APP_URL', false],
];

let ok = true;
console.log('Environment check (secret values are masked):');
for (const [name, secret] of checks) {
  const value = process.env[name] || '';
  const valid = name === "STUDENT_ID_PEPPER" ? value.length >= 32 : value.length > 0;
  if (!valid) ok = false;
  const shown = secret ? maskSecret(value) : (value || 'missing');
  console.log((valid ? 'OK   ' : 'MISS ') + name + ' = ' + shown);
}

if (!ok) {
  console.error('One or more required environment variables are missing or invalid.');
  process.exit(1);
}
console.log('Environment looks ready.');
