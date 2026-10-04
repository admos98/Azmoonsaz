#!/usr/bin/env python3
"""
Generate the Azmoonsaz page-background plates.

Pure stdlib, no deps. Every plate is a single self-contained SVG sized
1600x1000 with preserveAspectRatio="xMidYMid slice", meant to be used as
`background: url(...) center / cover no-repeat` on ONE fixed layer behind the
app shell.

    python3 tools/gen-backgrounds.py            # writes public/backgrounds/*.svg

Plates:
  D  distribution  isolines of a score distribution; one gold contour = the pass mark
  E  lens          a ruled grid bent by a lens; the page is the thing being refracted
  F  window        classroom light cast through a window, with real penumbra
  G  riso          two misregistered print plates with a deckled seam

Tuning lives in PARAMS at the bottom of each builder. Change a number, re-run,
nothing else in the app moves.
"""

import math
import os
import random

W, H = 1600, 1000
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "backgrounds")

# ── palette ───────────────────────────────────────────────────────────────
INK = "#221E4A"
GOLD = "#F5B301"
CREAM = "#F7F1E4"
VIOLET = "#7A6AD6"

THEMES = {
    "light": dict(page="#f2efe8", line=INK, grain=INK, bloom=GOLD,
                  # Round-1 parity: light drew its contours at dark's ALPHA,
                  # but at cream luminance the eye needs a bigger delta to
                  # see the same line (Weber) — 0.10 read as ~half of dark's
                  # perceived weight. Cap ~0.20 or gutters get noisy.
                  line_a=0.18, gold_a=0.55, grain_a=0.07, lift="#FFFDF8"),
    "dark":  dict(page="#131220", line=CREAM, grain=CREAM, bloom=VIOLET,
                  line_a=0.14, gold_a=0.55, grain_a=0.06, lift="#8C7AEB"),
}


def mark_ring(cx, cy, d, color, opacity, filled=False):
    """One answer bubble of The Mark: D diameter, stroke 0.22xD, gold = filled."""
    r = d / 2
    if filled:
        return f'<circle cx="{n(cx)}" cy="{n(cy)}" r="{n(r)}" fill="{color}" fill-opacity="{opacity}"/>'
    sw = d * 0.22
    return (f'<circle cx="{n(cx)}" cy="{n(cy)}" r="{n(r - sw/2)}" fill="none" '
            f'stroke="{color}" stroke-opacity="{opacity}" stroke-width="{n(sw)}"/>')


def mark_cluster(cx, cy, d, theme):
    """The 2x2 Mark grid at brand spec: spacing 1.4xD, gold bubble top-right.
    Large + ghost-alpha, so glass panels refract real brand geometry."""
    t = THEMES[theme]
    ink = t["line"]; gold = GOLD
    gap = d * 1.4
    o = gap / 2
    parts = [
        mark_ring(cx - o, cy - o, d, ink, 0.16 if theme == "light" else 0.20),
        mark_ring(cx + o, cy - o, d, gold, 0.34 if theme == "light" else 0.50, filled=True),
        mark_ring(cx - o, cy + o, d, ink, 0.16 if theme == "light" else 0.20),
        mark_ring(cx + o, cy + o, d, ink, 0.16 if theme == "light" else 0.20),
    ]
    return "".join(parts)


def grain(seed, color, freq=0.85):
    """Speckle, not a grey veil: noise -> alpha -> flood brand colour -> composite in."""
    return f"""<filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="{freq}" numOctaves="4" stitchTiles="stitch" seed="{seed}" result="t"/>
      <feColorMatrix in="t" type="matrix" result="a"
        values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.7 0.7 0.7 0 -0.6"/>
      <feFlood flood-color="{color}" result="f"/>
      <feComposite in="f" in2="a" operator="in"/>
    </filter>"""


def svg(defs, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
            f'preserveAspectRatio="xMidYMid slice">\n<defs>\n{defs}\n</defs>\n{body}\n</svg>\n')


def n(v):
    """short number"""
    s = f"{v:.1f}"
    return s[:-2] if s.endswith(".0") else s


# ══════════════════════════════════════════════════════════════════════════
# D — DISTRIBUTION : marching-squares isolines of a bimodal score field
# ══════════════════════════════════════════════════════════════════════════

def field(x, y):
    """A score landscape: a dominant cohort, a weaker tail, and a slope."""
    def g(cx, cy, sx, sy, a):
        return a * math.exp(-(((x - cx) ** 2) / (2 * sx * sx) + ((y - cy) ** 2) / (2 * sy * sy)))
    v = g(0.62, 0.34, 0.26, 0.30, 1.00)      # the main mass
    v += g(0.26, 0.74, 0.19, 0.22, 0.52)     # the trailing cohort
    v += g(0.90, 0.86, 0.14, 0.17, 0.30)     # the high outliers
    v += 0.10 * math.sin(x * 4.1 + 0.6) * math.cos(y * 3.3)   # terrain, not a bell chart
    return v


def marching_squares(vals, cols, rows, level):
    """Returns a list of polylines (lists of (x,y)) at `level`."""
    segs = []

    def ip(p1, p2, v1, v2):
        t = 0.5 if v2 == v1 else (level - v1) / (v2 - v1)
        return (p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t)

    for i in range(rows - 1):
        for j in range(cols - 1):
            v = [vals[i][j], vals[i][j + 1], vals[i + 1][j + 1], vals[i + 1][j]]
            p = [(j * W / (cols - 1), i * H / (rows - 1)),
                 ((j + 1) * W / (cols - 1), i * H / (rows - 1)),
                 ((j + 1) * W / (cols - 1), (i + 1) * H / (rows - 1)),
                 (j * W / (cols - 1), (i + 1) * H / (rows - 1))]
            idx = sum((1 << k) for k in range(4) if v[k] > level)
            if idx in (0, 15):
                continue
            e = {
                0: lambda: ip(p[0], p[1], v[0], v[1]),
                1: lambda: ip(p[1], p[2], v[1], v[2]),
                2: lambda: ip(p[2], p[3], v[2], v[3]),
                3: lambda: ip(p[3], p[0], v[3], v[0]),
            }
            table = {1: [(3, 0)], 2: [(0, 1)], 3: [(3, 1)], 4: [(1, 2)], 5: [(3, 0), (1, 2)],
                     6: [(0, 2)], 7: [(3, 2)], 8: [(2, 3)], 9: [(2, 0)], 10: [(0, 1), (2, 3)],
                     11: [(2, 1)], 12: [(1, 3)], 13: [(1, 0)], 14: [(0, 3)]}
            for a, b in table[idx]:
                segs.append((e[a](), e[b]()))

    # stitch segments into polylines so the file stays small
    key = lambda pt: (round(pt[0], 1), round(pt[1], 1))
    adj = {}
    for s in segs:
        adj.setdefault(key(s[0]), []).append(s)
        adj.setdefault(key(s[1]), []).append(s)
    used, lines = set(), []
    for s in segs:
        if id(s) in used:
            continue
        used.add(id(s))
        chain = [s[0], s[1]]
        for end in (0, 1):
            while True:
                tip = key(chain[0] if end == 0 else chain[-1])
                nxt = None
                for c in adj.get(tip, []):
                    if id(c) not in used:
                        nxt = c
                        break
                if not nxt:
                    break
                used.add(id(nxt))
                other = nxt[1] if key(nxt[0]) == tip else nxt[0]
                chain.insert(0, other) if end == 0 else chain.append(other)
        if len(chain) > 3:
            lines.append(chain)
    return lines


def build_D(theme):
    t = THEMES[theme]
    COLS, ROWS, LEVELS = 150, 94, 11
    PASS_LEVEL = 5          # which contour turns gold — "the pass mark"

    vals = [[field(j / (COLS - 1), i / (ROWS - 1)) for j in range(COLS)] for i in range(ROWS)]
    lo = min(min(r) for r in vals)
    hi = max(max(r) for r in vals)

    layers = []
    for k in range(1, LEVELS):
        lvl = lo + (hi - lo) * k / LEVELS
        polys = marching_squares(vals, COLS, ROWS, lvl)
        d = " ".join("M" + " L".join(f"{n(x)} {n(y)}" for x, y in pl) for pl in polys)
        if not d:
            continue
        gold = (k == PASS_LEVEL)
        layers.append(
            f'<path d="{d}" fill="none" stroke="{GOLD if gold else t["line"]}" '
            f'stroke-opacity="{t["gold_a"] if gold else t["line_a"]}" '
            f'stroke-width="{1.7 if gold else 1}" stroke-linecap="round" stroke-linejoin="round"/>')

    defs = f"""
    <radialGradient id="bloom" cx="0.62" cy="0.18" r="0.9">
      <stop offset="0%" stop-color="{t['bloom']}" stop-opacity="{0.20 if theme=='light' else 0.22}"/>
      <stop offset="55%" stop-color="{t['bloom']}" stop-opacity="{0.07 if theme=='light' else 0.07}"/>
      <stop offset="100%" stop-color="{t['bloom']}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="pool" cx="0.04" cy="1.03" r="0.95">
      <stop offset="0%" stop-color="{'#221E4A' if theme=='light' else '#000000'}" stop-opacity="{0.15 if theme=='light' else 0.5}"/>
      <stop offset="100%" stop-color="{'#221E4A' if theme=='light' else '#000000'}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="fade" cx="0.6" cy="0.34" r="0.9">
      <stop offset="0%" stop-color="#fff" stop-opacity="1"/>
      <stop offset="70%" stop-color="#fff" stop-opacity="{0.8 if theme=='light' else 0.7}"/>
      <stop offset="100%" stop-color="#fff" stop-opacity="{0.45 if theme=='light' else 0.25}"/>
    </radialGradient>
    <mask id="m"><rect width="{W}" height="{H}" fill="url(#fade)"/></mask>
    {grain(21, t['grain'])}"""

    # The Mark, ghosted large where panels actually sit (upper-right and a
    # low-left echo). Drawn OUTSIDE the contour mask so it stays crisp enough
    # for the lens to pick up; alpha tuned so it reads as watermark, not art.
    marks = (f'<g>{mark_cluster(W*0.66, H*0.30, 120, theme)}</g>\n'
             f'<g opacity="0.6">{mark_cluster(W*0.13, H*0.86, 74, theme)}</g>')

    body = (f'<rect width="{W}" height="{H}" fill="{t["page"]}"/>\n'
            f'<rect width="{W}" height="{H}" fill="url(#bloom)"/>\n'
            f'<g mask="url(#m)">\n' + "\n".join(layers) + "\n</g>\n"
            f'{marks}\n'
            f'<rect width="{W}" height="{H}" fill="url(#pool)"/>\n'
            f'<rect width="{W}" height="{H}" filter="url(#grain)" opacity="{t["grain_a"]}"/>')
    return svg(defs, body)


# ══════════════════════════════════════════════════════════════════════════
# E — LENS : a ruled grid bent by a radial magnifier
# ══════════════════════════════════════════════════════════════════════════

def build_E(theme):
    t = THEMES[theme]
    CX, CY = W * 0.63, H * 0.30      # where the lens sits
    K, SIG = 0.62, 430.0             # bulge strength, bulge radius
    PITCH = 84                       # grid spacing before bending
    STEP = 26                        # sampling step along each line

    def bend(x, y):
        dx, dy = x - CX, y - CY
        r2 = dx * dx + dy * dy
        amp = K * math.exp(-r2 / (2 * SIG * SIG))
        return x + dx * amp, y + dy * amp

    lines = []
    x = -PITCH * 3
    while x < W + PITCH * 3:
        pts = [bend(x, y) for y in range(-140, H + 141, STEP)]
        lines.append(pts)
        x += PITCH
    y = -PITCH * 3
    while y < H + PITCH * 3:
        pts = [bend(x, y) for x in range(-140, W + 141, STEP)]
        lines.append(pts)
        y += PITCH

    d = " ".join("M" + " L".join(f"{n(px)} {n(py)}" for px, py in pl) for pl in lines)

    defs = f"""
    <radialGradient id="bloom" cx="{CX/W}" cy="{CY/H}" r="0.62">
      <stop offset="0%" stop-color="{t['bloom']}" stop-opacity="{0.10 if theme=='light' else 0.20}"/>
      <stop offset="60%" stop-color="{t['bloom']}" stop-opacity="{0.02 if theme=='light' else 0.05}"/>
      <stop offset="100%" stop-color="{t['bloom']}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="caustic" cx="{CX/W}" cy="{CY/H}" r="0.30">
      <stop offset="0%" stop-color="{GOLD}" stop-opacity="{0.055 if theme=='light' else 0.09}"/>
      <stop offset="100%" stop-color="{GOLD}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="fade" cx="{CX/W}" cy="{CY/H}" r="0.80">
      <stop offset="0%" stop-color="#fff" stop-opacity="1"/>
      <stop offset="55%" stop-color="#fff" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <mask id="m"><rect width="{W}" height="{H}" fill="url(#fade)"/></mask>
    <radialGradient id="pool" cx="0.03" cy="1.04" r="0.92">
      <stop offset="0%" stop-color="{'#221E4A' if theme=='light' else '#000000'}" stop-opacity="{0.06 if theme=='light' else 0.48}"/>
      <stop offset="100%" stop-color="{'#221E4A' if theme=='light' else '#000000'}" stop-opacity="0"/>
    </radialGradient>
    {grain(34, t['grain'])}"""

    body = (f'<rect width="{W}" height="{H}" fill="{t["page"]}"/>\n'
            f'<rect width="{W}" height="{H}" fill="url(#bloom)"/>\n'
            f'<g mask="url(#m)"><path d="{d}" fill="none" stroke="{t["line"]}" '
            f'stroke-opacity="{t["line_a"]}" stroke-width="1" stroke-linecap="round"/></g>\n'
            f'<rect width="{W}" height="{H}" fill="url(#caustic)"/>\n'
            f'<rect width="{W}" height="{H}" fill="url(#pool)"/>\n'
            f'<rect width="{W}" height="{H}" filter="url(#grain)" opacity="{t["grain_a"]}"/>')
    return svg(defs, body)


# ══════════════════════════════════════════════════════════════════════════
# F — WINDOW : light cast through a classroom window, with penumbra
# ══════════════════════════════════════════════════════════════════════════

def build_F(theme):
    t = THEMES[theme]
    light = "#FFF4DA" if theme == "light" else "#B9A6FF"
    a_pane = 0.95 if theme == "light" else 0.16
    skew_x, skew_y = -0.42, 0.13     # the cast angle
    panes = []
    # 2 x 3 panes of a sash window, in the light's own space
    ox, oy, pw, ph, gap = 430, -240, 430, 370, 46
    for r in range(3):
        for c in range(2):
            x = ox + c * (pw + gap)
            y = oy + r * (ph + gap)
            panes.append(f'<rect x="{x}" y="{y}" width="{pw}" height="{ph}" rx="8"/>')
    panes_g = (f'<g transform="matrix(1,{skew_y},{skew_x},1,0,0)">' + "".join(panes) + "</g>")

    defs = f"""
    <filter id="penumbra" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="26"/>
    </filter>
    <filter id="spill" x="-45%" y="-45%" width="190%" height="190%">
      <feGaussianBlur stdDeviation="120"/>
    </filter>
    <linearGradient id="throw" x1="0.75" y1="0" x2="0.15" y2="1">
      <stop offset="0%" stop-color="#fff" stop-opacity="1"/>
      <stop offset="52%" stop-color="#fff" stop-opacity="0.62"/>
      <stop offset="100%" stop-color="#fff" stop-opacity="0.05"/>
    </linearGradient>
    <mask id="throwmask"><rect width="{W}" height="{H}" fill="url(#throw)"/></mask>
    <radialGradient id="pool" cx="0.02" cy="1.05" r="0.95">
      <stop offset="0%" stop-color="{'#221E4A' if theme=='light' else '#000000'}" stop-opacity="{0.085 if theme=='light' else 0.55}"/>
      <stop offset="100%" stop-color="{'#221E4A' if theme=='light' else '#000000'}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="warm" cx="0.8" cy="0.02" r="0.7">
      <stop offset="0%" stop-color="{GOLD}" stop-opacity="{0.07 if theme=='light' else 0.05}"/>
      <stop offset="100%" stop-color="{GOLD}" stop-opacity="0"/>
    </radialGradient>
    {grain(47, t['grain'])}"""

    body = (f'<rect width="{W}" height="{H}" fill="{t["page"]}"/>\n'
            f'<g mask="url(#throwmask)">\n'
            f'  <g fill="{light}" opacity="{a_pane*0.55:.3f}" filter="url(#spill)">{panes_g}</g>\n'
            f'  <g fill="{light}" opacity="{a_pane:.3f}" filter="url(#penumbra)">{panes_g}</g>\n'
            f'</g>\n'
            f'<rect width="{W}" height="{H}" fill="url(#warm)"/>\n'
            f'<rect width="{W}" height="{H}" fill="url(#pool)"/>\n'
            f'<rect width="{W}" height="{H}" filter="url(#grain)" opacity="{t["grain_a"]}"/>')
    return svg(defs, body)


# ══════════════════════════════════════════════════════════════════════════
# G — RISO : two print plates, slightly out of register, deckled seam
# ══════════════════════════════════════════════════════════════════════════

def build_G(theme):
    t = THEMES[theme]
    rng = random.Random(9)

    def deckle(y0, amp, wobble):
        """A torn paper edge running left to right."""
        pts, x, y = [], -60, y0
        while x < W + 60:
            y = y0 + amp * math.sin(x / wobble) + rng.uniform(-amp * 0.42, amp * 0.42)
            pts.append((x, y))
            x += 22
        return pts

    seam = deckle(H * 0.56, 34, 260)
    dpath = "M-60 " + n(H + 60) + " L" + " L".join(f"{n(x)} {n(y)}" for x, y in seam) + \
            f" L{W+60} {H+60} Z"
    # the same edge, printed 7px off register — that is the whole idea
    dpath2 = f'<path d="{dpath}" transform="translate(7,-9)"/>'

    plate = INK if theme == "light" else CREAM
    a1 = 0.045 if theme == "light" else 0.055

    defs = f"""
    <radialGradient id="bloom" cx="0.72" cy="0.05" r="0.85">
      <stop offset="0%" stop-color="{t['bloom']}" stop-opacity="{0.09 if theme=='light' else 0.17}"/>
      <stop offset="100%" stop-color="{t['bloom']}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="platefade" x1="0" y1="0" x2="0.2" y2="1">
      <stop offset="0%" stop-color="#fff" stop-opacity="1"/>
      <stop offset="100%" stop-color="#fff" stop-opacity="0.35"/>
    </linearGradient>
    <mask id="pf"><rect width="{W}" height="{H}" fill="url(#platefade)"/></mask>
    {grain(63, t['grain'], freq=0.62)}"""

    body = (f'<rect width="{W}" height="{H}" fill="{t["page"]}"/>\n'
            f'<rect width="{W}" height="{H}" fill="url(#bloom)"/>\n'
            f'<g mask="url(#pf)">\n'
            f'  <path d="{dpath}" fill="{plate}" fill-opacity="{a1}"/>\n'
            f'  <g fill="none" stroke="{GOLD}" stroke-opacity="{0.20 if theme=="light" else 0.26}" stroke-width="1.5">{dpath2}</g>\n'
            f'</g>\n'
            f'<rect width="{W}" height="{H}" filter="url(#grain)" opacity="{t["grain_a"]*1.25:.3f}"/>')
    return svg(defs, body)


# ══════════════════════════════════════════════════════════════════════════

BUILDERS = {"d": build_D, "e": build_E, "f": build_F, "g": build_G}

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for letter, fn in BUILDERS.items():
        for theme in ("light", "dark"):
            path = os.path.join(OUT, f"bg-{letter}-{theme}.svg")
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(fn(theme))
            print(f"{os.path.relpath(path):48s} {os.path.getsize(path)/1024:7.1f} KB")
