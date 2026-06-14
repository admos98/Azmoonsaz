import fs from 'node:fs';
import path from 'node:path';

let loaded = false;

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const eq = trimmed.indexOf('=');
  if (eq === -1) return null;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

function candidateEnvPaths() {
  const paths = [];
  let current = process.cwd();
  for (let i = 0; i < 5; i++) {
    paths.push(path.join(current, '.env.local'));
    paths.push(path.join(current, '.env'));
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return [...new Set(paths)];
}

export function loadApiEnv() {
  if (loaded) return;
  loaded = true;

  for (const envPath of candidateEnvPaths()) {
    if (!fs.existsSync(envPath)) continue;
    let text = fs.readFileSync(envPath, 'utf8');
    if (text.length > 0 && text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    for (const rawLine of text.split('\n')) {
      const parsed = parseEnvLine(rawLine.replace(/\r$/, ''));
      if (!parsed) continue;
      if (!(parsed.key in process.env)) {
        process.env[parsed.key] = parsed.value;
      }
    }
  }
}

loadApiEnv();
