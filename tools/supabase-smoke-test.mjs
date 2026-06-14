import { createClient } from '@supabase/supabase-js';
import { loadLocalEnv, maskSecret } from './env.mjs';

loadLocalEnv();

const url = process.env.VITE_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRole) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

console.log('Supabase URL:', url);
console.log('Service key:', maskSecret(serviceRole));

const supabase = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const tables = ['teacher_profiles', 'class_groups', 'students', 'exams', 'questions', 'student_exam_sessions'];
let ok = true;

for (const table of tables) {
  const { error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  if (error) {
    ok = false;
    console.error('MISS', table, '-', error.message);
  } else {
    console.log('OK  ', table);
  }
}

if (!ok) {
  console.error('Smoke test failed. Run supabase/schema-security-draft.sql in Supabase SQL Editor first.');
  process.exit(1);
}

console.log('Supabase schema smoke test passed.');
