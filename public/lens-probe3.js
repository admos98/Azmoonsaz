// Generate a radial-lens displacement PNG: exact (128,128) neutral interior,
// 4-fold symmetric by construction, R = x pull, G = y pull, alpha 255.
// Source-position model: inside the flat centre the sample is 1:1; across the
// outer band the sample point is pulled OUTWARD so the rim magnifies/bends.
function buildMapURL(N, edgeFrac){
  const c = document.createElement('canvas'); c.width = c.height = N;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(N, N);
  const d = img.data;
  const edge = edgeFrac;                       // fraction of half-size that is the bend zone
  for (let y = 0; y < N; y++){
    const ny = (y + 0.5) / N * 2 - 1;          // -1..1
    const ay = Math.abs(ny);
    for (let x = 0; x < N; x++){
      const nx = (x + 0.5) / N * 2 - 1;
      const ax = Math.abs(nx);
      // Chebyshev radius: 0 centre, 1 at the square edge — square-symmetric lens
      const r = Math.max(ax, ay);
      let pull = 0;                            // 0 = no shift, 1 = max outward pull
      if (r > 1 - edge){
        const u = (r - (1 - edge)) / edge;     // 0..1 across the rim band
        pull = u * u * (3 - 2 * u);            // smoothstep ramp into the rim
      }
      // pull direction: outward, split between axes by each axis's share.
      // At a side edge one axis dominates (clean perpendicular bend); at a
      // corner both share (diagonal bend). No dead branches.
      let dx = 0, dy = 0;
      if (pull > 0){
        const denom = ax + ay || 1;            // corner: ax=ay -> 50/50
        dx = Math.sign(nx) * pull * (ax / denom);
        dy = Math.sign(ny) * pull * (ay / denom);
      }
      const R = Math.round(128 + dx * 127);
      const G = Math.round(128 + dy * 127);
      const i = (y * N + x) * 4;
      d[i] = R; d[i+1] = G; d[i+2] = 128; d[i+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}

const fe = document.getElementById('v3-map');
const dm = document.getElementById('v3-dm');
const N = 256;
function rebuild(scale, edgePct){
  dm.setAttribute('scale', scale);
  fe.setAttribute('href', buildMapURL(N, edgePct / 100));
}
const scaleEl = document.getElementById('scale'), edgeEl = document.getElementById('edge');
const scaleV = document.getElementById('scalev'), edgeV = document.getElementById('edgev');
function sync(){ scaleV.textContent = scaleEl.value; edgeV.textContent = edgeEl.value; rebuild(+scaleEl.value, +edgeEl.value); report(); }
scaleEl.oninput = sync; edgeEl.oninput = sync;

document.getElementById('mode').onclick = () => document.body.classList.toggle('stripes');

// drag — measure the live box, move by viewport coords (panel is position:fixed)
const panel = document.getElementById('panel');
let drag = null;
panel.addEventListener('pointerdown', e => {
  const rect = panel.getBoundingClientRect();
  drag = { ox: e.clientX - rect.left, oy: e.clientY - rect.top };
  try { panel.setPointerCapture(e.pointerId); } catch(_) {}
  e.preventDefault();
});
window.addEventListener('pointermove', e => {
  if (!drag) return;
  panel.style.left = (e.clientX - drag.ox) + 'px';
  panel.style.top  = (e.clientY - drag.oy) + 'px';
});
window.addEventListener('pointerup', () => { drag = null; });

window.onerror = (msg) => {
  const r = document.getElementById('report');
  if (r) r.textContent = 'JS ERROR: ' + msg;
};

function report(){
  const cs = getComputedStyle(panel);
  const bf = cs.backdropFilter || cs.webkitBackdropFilter || '(none)';
  document.getElementById('report').textContent =
    'Chrome ' + (navigator.userAgent.match(/Chrom(?:e|ium)\/(\d+)/)||[])[1] +
    ' | url in computed: ' + /url\(/.test(bf) +
    ' | scale ' + dm.getAttribute('scale') + ' | edge ' + edgeEl.value + '%';
}
sync();
