import './env.js';
import crypto from 'node:crypto';

function base64url(input) {
  return Buffer.from(JSON.stringify(input)).toString('base64url');
}

function sign(data, secret) {
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

export function createStudentSessionToken(payload, ttlSeconds = 7200) {
  const secret = process.env.STUDENT_SESSION_SECRET || process.env.STUDENT_ID_PEPPER;
  if (!secret || secret.length < 32) {
    throw new Error('Student session secret is missing or too short');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const body = {
    ...payload,
    iat: now,
    exp: now + ttlSeconds,
  };

  const encodedHeader = base64url(header);
  const encodedBody = base64url(body);
  const signingInput = encodedHeader + '.' + encodedBody;
  return signingInput + '.' + sign(signingInput, secret);
}

export function verifyStudentSessionToken(token) {
  const secret = process.env.STUDENT_SESSION_SECRET || process.env.STUDENT_ID_PEPPER;
  if (!secret || secret.length < 32) {
    throw new Error('Student session secret is missing or too short');
  }

  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;

  const signingInput = parts[0] + '.' + parts[1];
  const expected = sign(signingInput, secret);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(parts[2]);

  if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
    return null;
  }

  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}
