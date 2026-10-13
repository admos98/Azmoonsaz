/**
 * Cloudflare Turnstile verification for start-session (Wave B).
 *
 * Only consulted when TURNSTILE_SECRET_KEY is configured — the feature is
 * opt-in per environment, so tests and deploys without keys keep working.
 * Fail-closed: if Cloudflare cannot be reached while the feature is ON,
 * the join attempt is refused (an attacker must not inherit availability).
 */
export async function verifyTurnstile(token, secret, remoteip) {
  if (!secret) return true;
  if (!token || typeof token !== 'string') return false;
  try {
    // L4: bound the outbound call — without a timeout a hung Cloudflare would
    // hold the serverless invocation until the platform kills it.
    const timeoutSignal =
      typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(10_000) : undefined;
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret, response: token, remoteip }),
      ...(timeoutSignal ? { signal: timeoutSignal } : {}),
    });
    if (!response.ok) {
      console.error('turnstile_http_' + response.status);
      return false;
    }
    const data = await response.json();
    return data?.success === true;
  } catch (error) {
    console.error('turnstile_verify_failed', error?.message || error);
    return false;
  }
}
