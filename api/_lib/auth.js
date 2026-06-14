export function getBearerToken(req, body = undefined) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  if (typeof header === 'string' && header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim();
  }
  if (body && typeof body.token === 'string') return body.token.trim();
  return '';
}
