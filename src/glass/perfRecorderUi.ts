/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The ?perf=1 recorder's minimal DOM overlay — extracted verbatim from
 * perfRecorder.ts. Plain DOM, no JSX (the a11y button gate walks every TSX
 * file under src); styled inline so it cannot affect the token gates. The
 * recorder passes its four ops through buildUi() at install time.
 */
import type { PerfReport } from './perfReporterTypes';

/* ───────────────────────── minimal UI ───────────────────────── */
/* Plain DOM, no JSX: the a11y button gate walks every TSX file under src and
   this must not be a lint liability — a dev-only overlay has no business in
   the design system. Styled inline so it cannot affect the token gates. */

interface UiOps {
  start: () => void;
  stop: () => PerfReport;
  copy: () => Promise<void>;
  download: () => void;
}

export function buildUi(ops: UiOps): void {
  if (document.getElementById('__perf_ui')) return;
  const box = document.createElement('div');
  box.id = '__perf_ui';
  box.setAttribute(
    'style',
    'position:fixed;right:12px;bottom:12px;z-index:2147483647;' +
      'font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;color:#e8e8ea;' +
      'background:rgba(18,18,20,.92);border:1px solid rgba(255,255,255,.16);' +
      'border-radius:10px;padding:10px 12px;width:236px;backdrop-filter:blur(8px);' +
      'box-shadow:0 8px 30px rgba(0,0,0,.4)',
  );
  const title = document.createElement('div');
  title.textContent = 'perf recorder';
  title.setAttribute('style', 'font-weight:600;margin-bottom:8px;opacity:.85');
  const out = document.createElement('div');
  out.setAttribute('style', 'min-height:34px;margin-bottom:8px;white-space:pre;opacity:.9');
  out.textContent = 'idle — press Record';
  const row = document.createElement('div');
  row.setAttribute('style', 'display:flex;gap:6px;flex-wrap:wrap');
  const mk = (label: string, fn: () => void) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.setAttribute(
      'style',
      'font:inherit;color:#e8e8ea;background:rgba(255,255,255,.09);border:1px solid ' +
        'rgba(255,255,255,.18);border-radius:7px;padding:4px 9px;cursor:pointer',
    );
    b.onclick = fn;
    return b;
  };
  let interval = 0;

  const show = (r: PerfReport) => {
    const e = r.engine;
    const b = e.boot;
    out.textContent =
      `fps avg ${r.summary.avgFps}  p1 ${r.summary.p1Fps}\n` +
      `scroll ${r.summary.fpsScroll}  still ${r.summary.fpsStill}\n` +
      `p95 ${r.summary.p95Ms}ms  worst ${r.summary.worstMs}ms\n` +
      `jank ${r.summary.jankFrames}  longtasks ${r.summary.longTasks.count}\n` +
      `filters ${r.filterCountStart}->${r.filterCountEnd}\n` +
      `render ${e.mode}/${e.drawn}  probe ${b.probe}\n` +
      `tier ${b.tier} lens ${b.lens}${b.broken ? ' broken!' : ''}\n` +
      `plate ${b.plate ?? '-'}${b.plateRetries ? ` r${b.plateRetries}` : ''}${b.plateSrc ? ` ${b.plateSrc}` : ''}${b.plateEsc ? ' esc' : ''}${b.plateTried?.length ? ` [${b.plateTried.join(' ')}]` : ''}\n` +
      (b.plateProbe?.length ? `plateProbe ${b.plateProbe.join(' | ')}\n` : '') +
      `maps ${e.maps} infl ${e.inflight} post ${e.posted} hit ${e.hits} wrk ${e.worker} sync ${e.sync}`;
  };

  const bRec = mk('Record', () => {
    ops.start();
    if (interval) clearInterval(interval);
    interval = window.setInterval(() => {
      // nodeValue, not textContent: assigning textContent replaces the child
      // text node (1 addedNode per tick = a permanent 4-nodes/bin floor in our
      // own mutation census). A characterData write moves no nodes.
      const t = `● recording\n${(performance.now() / 1000).toFixed(1)}s  filters ${document.querySelectorAll('filter[id^="lg-"]').length}`;
      if (out.firstChild) out.firstChild.nodeValue = t;
      else out.textContent = t;
    }, 250);
    setUi();
  });
  const bStop = mk('Stop', () => {
    if (interval) clearInterval(interval);
    interval = 0;
    show(ops.stop());
    setUi();
  });
  const bCopy = mk('Copy report', () => void ops.copy());
  const bDown = mk('Download', () => ops.download());
  row.append(bRec, bStop, bCopy, bDown);
  box.append(title, out, row);
  document.body.appendChild(box);

  function setUi(): void {
    const recording = interval !== 0;
    const hasReport = window.__perf?.report != null;
    bRec.disabled = recording;
    bStop.disabled = !recording;
    bCopy.disabled = !hasReport;
    bDown.disabled = !hasReport;
  }
  setUi();
}