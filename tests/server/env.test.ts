/**
 * env.js loadApiEnv() — the API's .env loader (CQ-8 coverage gap).
 *
 * Runs at import time in production, so the tests exercise it through fresh
 * dynamic imports (vi.resetModules) after chdir'ing into a temp dir whose
 * parent chain cannot contain the repo's own .env files. Every case uses
 * uniquely-keyed variables and cleans process.env afterwards.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ORIGINAL_CWD = process.cwd();
let dir: string;

/** Unique keys — never collide with real config the other suites rely on. */
const K1 = 'TEST_API_ENV_FIXTURE_KEY_1';
const K2 = 'TEST_API_ENV_FIXTURE_KEY_2';
const K3 = 'TEST_API_ENV_FIXTURE_KEY_3';

async function freshImport() {
  vi.resetModules();
  return import('../../api/_lib/env.js');
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'azmoonsaz-env-'));
  process.chdir(dir);
  delete process.env[K1];
  delete process.env[K2];
  delete process.env[K3];
});

afterEach(() => {
  process.chdir(ORIGINAL_CWD);
  rmSync(dir, { recursive: true, force: true });
  delete process.env[K1];
  delete process.env[K2];
  delete process.env[K3];
});

describe('loadApiEnv', () => {
  it('parses KEY=VALUE, strips surrounding quotes and whitespace', async () => {
    writeFileSync(
      join(dir, '.env.local'),
      [
        '# a comment line',
        '',
        `   ${K1}   =   "quoted value"  `,
        `${K2}='single quoted'`,
        `${K3}=plain`,
      ].join('\n'),
    );
    await freshImport();
    expect(process.env[K1]).toBe('quoted value');
    expect(process.env[K2]).toBe('single quoted');
    expect(process.env[K3]).toBe('plain');
  });

  it('never overrides a variable that is already set in the environment', async () => {
    process.env[K1] = 'wins';
    writeFileSync(join(dir, '.env'), `${K1}=loses\n`);
    await freshImport();
    expect(process.env[K1]).toBe('wins');
  });

  it('skips lines without "=" and does not crash on them', async () => {
    writeFileSync(join(dir, '.env'), ['JUST_A_WORD', `${K1}=ok`].join('\n'));
    await freshImport();
    expect(process.env[K1]).toBe('ok');
  });

  it('strips a UTF-8 BOM before the first key and handles CRLF endings', async () => {
    writeFileSync(join(dir, '.env'), `\uFEFF${K1}=bom-value\r\n${K2}=crlf-value\r\n`);
    await freshImport();
    expect(process.env[K1]).toBe('bom-value');
    expect(process.env[K2]).toBe('crlf-value');
  });

  it('tolerates a directory with no env files at all', async () => {
    await expect(freshImport()).resolves.toBeTypeOf('object');
  });

  it('discovers .env.local in a parent directory (walks up, .env.local first)', async () => {
    const child = join(dir, 'nested', 'deeper');
    mkdirSync(child, { recursive: true });
    writeFileSync(join(dir, '.env.local'), `${K1}=from-parent-local\n`);
    process.chdir(child);
    await freshImport();
    expect(process.env[K1]).toBe('from-parent-local');
  });
});
