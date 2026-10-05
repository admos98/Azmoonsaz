#!/usr/bin/env python3
"""Glass family maps — lens / pane / drop displacement + specular rasters.

Physics port of the playground's kube.io replica (tools/reference/playground/
playground.js buildDisplacementMap/computeProfile/buildSpecularMap), same
math end to end:

  convex-squircle surface  ->  surface normal  ->  Snell refraction
  (n1=1, n2=1.5)  ->  per-distance profile (monotone head, box-smoothed)
  ->  rounded-rect / disc border field  ->  normalized R/G displacement map

SOURCE OF TRUTH IS src/index.css: geometry (--lens-size/-radius/-bezel/
-thickness for the rect family, --drop-* for the disc) is PARSED from the
tokens, so a map can only ever be built from the approved tune. Rasters
are 2x canonical (lens 652x128, drop 88x88) so the vector field stays
smooth when feImage stretches it box-clipped onto an element.

The border starts at the PEAK and decays smoothly inward (monotone head +
two box-smooth passes — the fix for the "bad corner" tearing).

Feeding lens-map.png to <feDisplacementMap scale="43.67"> gives +/-21.8px
peak pull at the border (approved playground number; the head-smoothed
profile normalizes to maxAbs 40.35 — normalization only, not the pull).
drop-map.png rides scale="5" (+/-2.5px on a 44px disc — a stronger lens
RELATIVE to its diameter). The script verifies both scales in index.html.

Also emits lens-spec.png and drop-spec.png — the playground's
buildSpecularMap port (cos^2 x bump, light from --lens-spec-angle), which
the lens/pane/drop filters composite as the reflective rim.

Stdlib only — writes RGBA8 PNG without Pillow.
Run: python tools/gen-glass-maps.py
"""

from __future__ import annotations

import math
import re
import struct
import sys
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSS_PATH = ROOT / "src" / "index.css"
HTML_PATH = ROOT / "index.html"
LENS_OUT = ROOT / "public" / "lens-map.png"
LENS_SPEC_OUT = ROOT / "public" / "lens-spec.png"
DROP_OUT = ROOT / "public" / "drop-map.png"
DROP_SPEC_OUT = ROOT / "public" / "drop-spec.png"

MAP_SCALE = 2  # raster 2x the canonical size (smooth field under stretch)
IOR = 1.5
SAMPLES = 256


def css_token(css: str, name: str) -> str:
    m = re.search(re.escape(name) + r":\s*([^;]+);", css)
    if not m:
        sys.exit(f"gen-glass-maps: token {name} not found in {CSS_PATH}")
    return m.group(1).strip()


def load_tune() -> dict:
    """Read the approved geometry from the CSS tokens (single source)."""
    css = CSS_PATH.read_text(encoding="utf-8")
    px = lambda v: float(v.removesuffix("px"))  # noqa: E731
    lw_s, lh_s = css_token(css, "--lens-size").split()
    dw_s, dh_s = css_token(css, "--drop-size").split()
    shared = {
        "bezel": px(css_token(css, "--lens-bezel")),
        "thickness": px(css_token(css, "--lens-thickness")),
        "angle": float(css_token(css, "--lens-spec-angle").removesuffix("deg")),
    }
    lens = {
        "w": px(lw_s),
        "h": px(lh_s),
        "radius": px(css_token(css, "--lens-radius")),
        "max_disp": css_token(css, "--lens-max-displacement").removesuffix("px"),
        **shared,
    }
    drop = {
        "w": px(dw_s),
        "h": px(dh_s),
        "radius": px(css_token(css, "--drop-radius")),
        "max_disp": css_token(css, "--drop-max-displacement").removesuffix("px"),
        **shared,
    }
    return {"lens": lens, "drop": drop}


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
    """Signed component distances from the inner inset rect edge.
    p = min(radius, min(w,h)/2 - 1) — at p = half the short side the inset
    degenerates to a point and the field becomes a DISC (the drop map)."""
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


def build(tune: dict) -> tuple[bytes, int, int, float]:
    # profile in CSS px (validates against the playground's maxAbs)
    profile = compute_profile(tune["bezel"], tune["thickness"])
    max_abs = max(abs(v) for v in profile) or 1.0
    # raster in map px (2x the canonical size)
    w = int(tune["w"] * MAP_SCALE)
    h = int(tune["h"] * MAP_SCALE)
    p = min(tune["radius"] * MAP_SCALE, min(w, h) / 2 - 1)
    bez = max(0.75, tune["bezel"] * MAP_SCALE)
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
    return bytes(buf), w, h, max_abs


def build_specular(tune: dict) -> bytes:
    """Specular rim map — exact port of the playground's buildSpecularMap:
    white-ish grey whose alpha = cos^2(normal - light) x parabolic bump,
    bump peaked MAP_SCALE px inside the border, zero AT the border. Light
    angle from --lens-spec-angle (playground: -55deg). RGBA8, transparent
    elsewhere; stretched onto the element by feImage."""
    w = int(tune["w"] * MAP_SCALE)
    h = int(tune["h"] * MAP_SCALE)
    p = min(tune["radius"] * MAP_SCALE, min(w, h) / 2 - 1)
    g_out = (p + 1) ** 2
    light = tune["angle"] * math.pi / 180
    ring = 2 * MAP_SCALE  # bump support: 0 .. 2*MAP_SCALE map px
    peak = 1 * MAP_SCALE  # bump peak position
    js_round = lambda v: int(v + 0.5)  # noqa: E731  Math.round is half-up
    buf = bytearray(w * h * 4)  # all zeros = transparent
    for y in range(h):
        for x in range(w):
            l, m = border_sdf(x, y, w, h, p)
            s2 = l * l + m * m
            if s2 > g_out:
                continue
            t = math.sqrt(s2)
            if t < 1e-6:
                continue
            r_d = p - t  # distance from border
            if r_d > ring:
                continue
            k = (r_d - peak) / peak  # parabolic window
            bump = 1 - k * k
            if bump <= 0:
                continue
            theta = math.atan2(m, l)  # outward normal angle
            cv = math.cos(theta - light)
            it = cv * cv * bump  # cos^2 x bump
            a = min(255, js_round(it * 255))
            if a <= 0:
                continue
            g = min(255, js_round(math.sqrt(it) * 255))
            i = (y * w + x) * 4
            buf[i] = g
            buf[i + 1] = g
            buf[i + 2] = g
            buf[i + 3] = a
    return bytes(buf)


def emit(name: str, out: Path, tune: dict) -> None:
    rgba, w, h, max_abs = build(tune)
    write_png(out, w, h, rgba)
    print(
        f"wrote {out}  {w}x{h} (2x of {tune['w']}x{tune['h']})  "
        f"radius={tune['radius']}  profile maxAbs={max_abs:.2f}px"
    )
    spec_out = Path(str(out).replace("-map.png", "-spec.png"))
    write_png(spec_out, w, h, build_specular(tune))
    print(f"wrote {spec_out}  {w}x{h}  light angle {tune['angle']}deg")


def main() -> None:
    tunes = load_tune()
    emit("lens", LENS_OUT, tunes["lens"])
    emit("drop", DROP_OUT, tunes["drop"])
    # both filters must carry the same max displacement as their tokens
    html = HTML_PATH.read_text(encoding="utf-8")
    for name in ("lens", "drop"):
        want = f'scale="{tunes[name]["max_disp"]}"'
        if want not in html:
            sys.exit(
                f"gen-glass-maps: index.html is missing {want} "
                f"(--{name}-max-displacement = {tunes[name]['max_disp']}px)"
            )
        print(f"filter scale verified: {want}")


if __name__ == "__main__":
    main()
