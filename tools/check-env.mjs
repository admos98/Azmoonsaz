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

// Image store provider is optional: Supabase is the default and needs no
// extra vars. S3 (Parspack/Arvan) activates only when fully configured —
// warn here, never fail: the server logs once at runtime and stays on Supabase.
const provider = String(process.env.IMAGE_STORE_PROVIDER || 'supabase').toLowerCase();
if (provider === 's3') {
  const missing = ['S3_ENDPOINT', 'S3_ACCESS_KEY', 'S3_SECRET_KEY', 'S3_BUCKET'].filter(
    (name) => !String(process.env[name] || '').trim(),
  );
  if (missing.length > 0) {
    console.log(
      'WARN IMAGE_STORE_PROVIDER=s3 is incomplete (missing ' +
        missing.join(', ') +
        ') — image uploads stay on Supabase until all four are set.',
    );
  } else {
    console.log('OK   image store provider = s3');
  }
} else {
  console.log('OK   image store provider = supabase (default)');
}

console.log('Environment looks ready.');
