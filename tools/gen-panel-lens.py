#!/usr/bin/env python3
"""Panel lens displacement map — the Type A/B shared glass material.

Physics port of the playground's kube.io replica (public/playground/
playground.js buildDisplacementMap/computeProfile), same math end to end:

  convex-squircle surface  ->  surface normal  ->  Snell refraction
  (n1=1, n2=1.5)  ->  per-distance profile (monotone head, box-smoothed)
  ->  rounded-rect border field  ->  normalized R/G displacement map

Replaces the earlier heuristic (mirror zones / U-pull / zero verticals)
with the tuned physical model — the app panels must bend exactly like the
playground that produced the approved tune.

The map is SQUARE canonical geometry: <feImage preserveAspectRatio="none">
stretches it box-clipped onto whatever panel consumes #panel-lens, so
proportions carry the shape, not pixels — the same contract as
/lens-map.png. The border starts at the PEAK and decays smoothly inward
(no 0 -> peak cliff: monotone head + two box-smooth passes — the fix for
the "bad corner" tearing).

Feed the PNG to <feDisplacementMap scale="44">  ->  max +/-22px pull at
the border (the tuned playground number: refraction 0.5 x 43.7px).

Stdlib only — writes RGBA8 PNG without Pillow.
"""

from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path

# ── canonical geometry (map space) ──────────────────────────────────────────
SIZE = 512  # square; stretched onto the panel box by feImage
RADIUS = 64  # corner radius of the rounded rect the band follows
BEZEL = 24  # band width = the decay distance of the profile
# playground ratio thickness:bezel = 72:14
THICKNESS = 123
IOR = 1.5
SAMPLES = 256

OUT = Path(__file__).resolve().parent.parent / "public" / "panel-lens-map.png"


def surface(s: float) -> float:
    """Convex squircle (kube.io surface family, n=4)."""
    return (1 - (1 - s) ** 4) ** 0.25


def refract2d(nx: float, ny: float, eta: float):
    """Snell refraction of a vertical ray about a 2-D normal.
    None on total internal reflection."""
    r = 1 - eta * eta * (1 - ny * ny)
    if r < 0:
        return None
    i = math.sqrt(r)
    return [-(eta * ny + i) * nx, eta - (eta * ny + i) * ny]


def compute_profile(bezel_px: float, thickness_px: float, samples: int = SAMPLES):
    """Horizontal displacement (px) of a ray that hits the bezel at
    normalized distance s from the border. Exact port of computeProfile:
    numeric derivative of the surface, refract, depth scaling, then the
    head fix — border starts at the peak, decays monotonically, box
    smoothed twice, last sample zeroed."""
    eta = 1 / IOR
    out = [0.0] * samples
    for k in range(samples):
        s = k / samples
        c = surface(s)
        eps = 1e-4 if s < 1 else -1e-4
        u = (surface(min(1.0, max(0.0, s + eps))) - c) / eps
        d = math.hypot(u, 1)
        n = refract2d(-u / d, -1 / d, eta)
        if n:
            depth = c * thickness_px + bezel_px  # ray origin height
            out[k] = n[0] * (depth / n[1])
        else:
            out[k] = 0.0
    # monotone head (kills the squircle's infinite-slope spike at s=0)
    out[0] = out[1]
    for i in range(2, samples):
        if abs(out[i]) > abs(out[i - 1]):
            out[i] = out[i - 1]
    for _ in range(2):  # 2x box smooth
        tmp = out[:]
        for i in range(1, samples - 1):
            out[i] = (tmp[i - 1] + 2 * tmp[i] + tmp[i + 1]) / 4
    out[samples - 1] = 0.0
    return out


def border_sdf(x: float, y: float, w: int, h: int, p: float):
    """Signed component distances from the inner inset rect edge."""
    l = x - p if x < p else (x - (w - p) if x >= w - p else 0.0)
    m = y - p if y < p else (y - (h - p) if y >= h - p else 0.0)
    return l, m


def write_png(path: Path, w: int, h: int, rgba: bytes) -> None:
    """Minimal PNG encoder (RGBA8, filter 0), no dependencies."""

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    scanlines = b"".join(
        b"\x00" + rgba[y * w * 4:(y + 1) * w * 4] for y in range(h)
    )
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(scanlines, 9))
        + chunk(b"IEND", b"")
    )


def build(size: int = SIZE) -> tuple[bytes, float]:
    profile = compute_profile(BEZEL, THICKNESS)
    max_abs = max(abs(v) for v in profile) or 1.0
    w = h = size
    p = min(RADIUS, min(w, h) / 2 - 1)
    bez = max(0.75, float(BEZEL))
    g_out = (p + 1) ** 2
    g_in = p * p
    g_lo = (p - bez) ** 2
    n = len(profile)

    buf = bytearray(w * h * 4)
    # neutral fill: R=128 G=128 B=0 A=255 (B unused by feDisplacementMap)
    for i in range(0, len(buf), 4):
        buf[i] = 128
        buf[i + 1] = 128
        buf[i + 2] = 0
        buf[i + 3] = 255

    for y in range(h):
        for x in range(w):
            l, m = border_sdf(x, y, w, h, p)
            s2 = l * l + m * m
            if s2 > g_out or s2 < g_lo:
                continue
            t = math.sqrt(s2)
            if t < 1e-6:
                continue
            fade = 1.0
            if s2 > g_in:
                fade = max(0.0, 1 - (t - p))  # 1px AA ring
            r_d = p - t  # distance from border
            idx = min(n - 1, max(0, int(r_d / bez * n)))
            v = profile[idx] / max_abs  # normalized [-1,1]
            ux = -l / t  # inward unit vector
            uy = -m / t
            i = (y * w + x) * 4
            buf[i] = int(128 + ux * v * 127 * fade) & 0xFF
            buf[i + 1] = int(128 + uy * v * 127 * fade) & 0xFF
            # B stays 0, A stays 255
    return bytes(buf), max_abs


def main() -> None:
    rgba, max_abs = build()
    write_png(OUT, SIZE, SIZE, rgba)
    print(
        f"wrote {OUT}  {SIZE}x{SIZE}  "
        f"profile maxAbs={max_abs:.2f}px  bezel={BEZEL} thickness={THICKNESS}"
    )


if __name__ == "__main__":
    main()
