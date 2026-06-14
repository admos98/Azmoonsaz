import fs from 'node:fs';
import path from 'node:path';

export function loadLocalEnv(root = process.cwd()) {
  const envPath = path.join(root, '.env.local');
  if (!fs.existsSync(envPath)) return { loaded: false, path: envPath };
  const text = fs.readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('\"') && value.endsWith('\"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
  return { loaded: true, path: envPath };
}

export function maskSecret(value) {
  const text = String(value || '');
  if (!text) return 'missing';
  if (text.length <= 10) return 'set';
  return text.slice(0, 4) + '...' + text.slice(-4);
}
