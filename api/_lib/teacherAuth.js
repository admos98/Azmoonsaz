import { getSupabaseAdmin, getSupabasePublicServerClient } from './supabaseAdmin.js';

export function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  if (typeof header === 'string' && header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim();
  }
  return '';
}

export async function requireTeacher(req, res) {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'missing_teacher_token' });
    return null;
  }

  const publicClient = getSupabasePublicServerClient();
  const { data, error } = await publicClient.auth.getUser(token);
  if (error || !data?.user) {
    res.status(401).json({ error: 'invalid_teacher_token' });
    return null;
  }

  return {
    id: data.user.id,
    email: data.user.email || '',
    admin: getSupabaseAdmin(),
  };
}
