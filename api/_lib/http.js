export function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
}

export function json(res, status, body) {
  setSecurityHeaders(res);
  res.status(status).json(body);
}

export function requireMethod(req, res, methods) {
  if (!methods.includes(req.method)) {
    res.setHeader('Allow', methods.join(', '));
    json(res, 405, { error: 'method_not_allowed' });
    return false;
  }
  return true;
}

export function getClientIp(req) {
  // Vercel sets x-real-ip from the trusted hop. x-forwarded-for is
  // client-controllable: the FIRST entry is attacker-supplied, so only the
  // LAST entry (appended by the edge) may be trusted. Never key limits on it first.
  const real = req.headers['x-real-ip'];
  if (typeof real === 'string' && real.trim().length > 0) return real.trim();
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    const parts = forwarded.split(',');
    const last = parts[parts.length - 1].trim();
    if (last.length > 0) return last;
  }
  return req.socket?.remoteAddress || 'unknown';
}
