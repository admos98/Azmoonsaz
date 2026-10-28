/**
 * @license SPDX-License-Identifier: Apache-2.0
 *
 * Lighthouse CI config (Meraj v7) — the 95-score path's missing half. Runs
 * against the BUILT dist (npm run build → lhci collect staticDistDir), so
 * every assertion measures what ships, never the dev server.
 *
 * What the static render is: `/` boots hermetically (no env in CI) into the
 * BootScreen → Login page — the exact surfaces a fresh student/teacher hit.
 * That is the honest audit target for perf/a11y/best-practices.
 *
 * Assertion policy (deterministic, no flaky gates):
 *  · performance ≥ 0.90 — the glass stack is heavy by design; 0.90 on the
 *    built bundle is the floor, the ratchet tightens from here.
 *  · accessibility ≥ 0.95 — the brand's own contrast/token gates already
 *    police this; Lighthouse is the independent referee.
 *  · best-practices ≥ 0.90.
 *  · seo = warn — the app is a logged-in tool behind routes, not a public
 *    content page; SEO audits must not block the gate.
 *  · Flaky/environment audits are off: cache-TTL is the host's (Vercel)
 *    business, CSP is split-server and audited by api tests, and the
 *    workbox/window audits misread the SPA shell.
 */
module.exports = {
  ci: {
    collect: {
      // Only the app shell — `/` is the honest audit surface (the kit audits
      // what ships to students/teachers). Without `url`, collect autodiscovers
      // every HTML file in dist, dragging in the internal WebGL lab
      // (perf 0.73 — a dozen live panels) and the welcome page, neither of
      // which are user surfaces. Setting url disables autodiscovery.
      url: ['http://localhost:3000/'],
      staticDistDir: 'dist',
      numberOfRuns: 3,
      settings: {
        // Mobile emulation is Lighthouse's default — the student body is
        // overwhelmingly on phones; keep it as the enforcement surface.
        maxWaitForLoad: 45000,
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.8 }],

        // Environment-owned, not app-owned — off, with reasons:
        'uses-long-cache-ttl': 'off', // asset caching is Vercel's layer
        'csp-xss': 'off', // CSP is served by the API layer; static preview has none
        'is-closable': 'off', // LHCI internal
        'legacy-javascript': 'warn', // report, don't gate — Babel-less build is already lean

        // The main-thread audits that DO matter for the genie morph:
        'long-tasks': ['warn', { thresholdInMs: 200 }],
        'user-timings': 'off', // perf marks are lab-only (perf=1)
      },
    },
    upload: {
      // No external storage needed — assertions gate the build; the JSON
      // artifacts land in .lighthouseci for the workflow to attach.
      target: 'temporary-public-storage',
    },
  },
};
