import { json, requireMethod } from './_lib/http.js';
import { validateIranianNationalId, normalizeNationalId, maskNationalId, nationalIdHash } from './_lib/crypto.js';

export default function handler(req, res) {
  if (!requireMethod(req, res, ['POST'])) return;

  const { nationalId } = req.body || {};
  const normalized = normalizeNationalId(nationalId);

  if (!validateIranianNationalId(normalized)) {
    json(res, 400, { error: 'invalid_national_id' });
    return;
  }

  try {
    json(res, 200, {
      ok: true,
      masked: maskNationalId(normalized),
      hashPreview: nationalIdHash(normalized).slice(0, 12) + '...'
    });
  } catch (err) {
    json(res, 500, { error: 'server_secret_not_configured' });
  }
}
