/**
 * Welcome narrative choreography (Meraj P3) — the whole script is three
 * observers and one scroll handler:
 *   1. sections reveal once as they arrive (IntersectionObserver, unobserve
 *      after fire — one-shot, pulse discipline);
 *   2. the seal chapter stamps once (same observer, special case);
 *   3. the progress thread tracks the story's scroll position.
 * Reduced motion needs none of this: CSS shows everything statically, and
 * the observers no-op (their class adds are harmless either way).
 * CSP-safe: module script, no inline code, no fetches.
 */

const revealables = document.querySelectorAll('.reveal');
const stamp = document.getElementById('stamp');
const bar = document.getElementById('progress-bar');

/* 1 + 2 — arrive → reveal (and stamp the seal chapter) */
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        if (stamp && entry.target.contains(stamp)) stamp.classList.add('is-stamped');
        io.unobserve(entry.target); // one-shot: a reveal never re-runs
      }
    },
    { threshold: 0.35 },
  );
  revealables.forEach((el) => io.observe(el));
} else {
  // No observer support: the story is simply already told.
  revealables.forEach((el) => el.classList.add('is-in'));
  stamp?.classList.add('is-stamped');
}

/* 3 — the thread */
if (bar) {
  const paint = () => {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const pct = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    bar.style.width = `${(pct * 100).toFixed(2)}%`;
  };
  paint();
  window.addEventListener('scroll', paint, { passive: true });
  window.addEventListener('resize', paint, { passive: true });
}
