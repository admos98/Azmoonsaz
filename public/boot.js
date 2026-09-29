/**
 * Boot script — theme, motion, glass tier, lens gate, LCP preload.
 *
 * Runs SYNCHRONOUSLY from <head> before first paint (no defer): data-theme /
 * data-glass / data-lens must be set before the first style resolution or the
 * page flashes un-themed and every glass panel paints its fallback tier.
 *
 * Externally hosted (/boot.js), NOT inline: Vercel serves
 * `Content-Security-Policy: script-src 'self'`, which blocks inline <script>
 * entirely — this file existed as an inline block and was silently blocked in
 * production, so data-lens never turned on and the refraction bend never
 * rendered on the live site. Keep it external; keep `src` same-origin.
 */
(() => {

  // LCP art preload — only when the login screen will actually paint.
  // The static <link rel=preload> fired on EVERY route (SPA rewrites everything
  // to index.html), so /teacher/* downloaded the login art and never used it →
  // "preloaded but not used" console warning. Gate: canonical login path AND no
  // persisted Supabase session (persistSession writes sb-*-auth-token).
  try {
    const p = location.pathname;
    const hasSession = Object.keys(localStorage).some(
      (k) => k.startsWith('sb-') && k.endsWith('-auth-token'),
    );
    if ((p === '/' || p === '') && !hasSession) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.type = 'image/avif';
      link.href = '/login-education-light.avif';
      document.head.appendChild(link);
    }
  } catch {}

  const key = 'azmoonsaz-theme';
  let preference = 'system';
  try {
    const saved = localStorage.getItem(key);
    if (saved === 'light' || saved === 'dark' || saved === 'system') preference = saved;
  } catch {}
  const theme =
    preference === 'system'
      ? matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : preference;
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;

  const motionKey = 'azmoonsaz-motion';
  let motionPreference = 'system';
  try {
    const savedMotion = localStorage.getItem(motionKey);
    if (savedMotion === 'reduced' || savedMotion === 'full' || savedMotion === 'system') {
      motionPreference = savedMotion;
    }
  } catch {}
  const systemReducesMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const resolvedMotion =
    motionPreference === 'reduced' || systemReducesMotion ? 'reduce' : 'full';
  document.documentElement.dataset.motionPreference = motionPreference;
  document.documentElement.dataset.motion = resolvedMotion;

  // Material tier probe — resolved ONCE, before first paint. One of:
  //   full — every glass layer (modern GPUs)
  //   lite — blur-free tinted fill + rim + shadow (weak GPUs,
  //          prefers-reduced-transparency)
  //   off  — solid fills + borders (forced-colors, ≤2 GB devices)
  // The user's explicit choice (azmoonsaz-glass) always wins over the
  // probe; Apple never takes the Reduce Transparency switch away.
  const glassKey = 'azmoonsaz-glass';
  let glassOverride = null;
  try {
    const savedGlass = localStorage.getItem(glassKey);
    if (savedGlass === 'full' || savedGlass === 'lite' || savedGlass === 'off') {
      glassOverride = savedGlass;
    }
  } catch {}
  if (glassOverride) {
    document.documentElement.dataset.glass = glassOverride;
  } else {
    let tier = 'full';
    try {
      if (matchMedia('(forced-colors: active)').matches) tier = 'off';
      else if (matchMedia('(prefers-reduced-transparency: reduce)').matches) tier = 'lite';
      else if ((navigator.deviceMemory ?? 8) <= 2) tier = 'off';
      // NOTE: the old hardware-sniffing downgrade (CPU core count and
      // device-memory heuristics → lite) is RETIRED.
      // navigator.deviceMemory reports 4 on many 16 GB machines (it is
      // capped and rounded), which silently stripped blur on perfectly
      // capable hardware — the app shipped as blurless tinted plastic
      // with no way to see why. Blur stays on unless the device really
      // cannot afford it or the user asks for less.
    } catch {}
    document.documentElement.dataset.glass = tier;
  }

  // Lens gate — SVG reference filters inside backdrop-filter only render
  // on Chromium >= 138. Older engines pass the SYNTAX probe
  // (CSS.supports('backdrop-filter', "url('#x')") === true) but silently
  // drop the whole declaration at paint time — including the blur that
  // was chained after it. Gating on version means the lens is purely
  // additive: every browser keeps blur() + saturate(), Chromium 138+
  // additionally bends the rim.
  try {
    const m = navigator.userAgent.match(/Chrom(?:e|ium)\/(\d+)/);
    const major = m ? parseInt(m[1], 10) : 0;
    document.documentElement.dataset.lens = major >= 138 ? 'on' : 'off';
  } catch {
    document.documentElement.dataset.lens = 'off';
  }
})();
