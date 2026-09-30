# gen-panel-lens.py -- the Type A/B displacement map.
#
# User spec (session 2026-09-30):
#  - Horizontal edges pull the backdrop DOWN/UP (mirror), verticals pull zero.
#  - The pull starts a few mm from the edge (safe distance), consistent force,
#    then bends toward the corner like a black hole.
#  - At the corner the pulled colour rotates: pulled down by the bottom edge,
#    pushed up and sucked into the nearest vertical edge (U-shape), fading
#    before it reaches the far corner on tall panels.
#  - Rim reflection: the outer band samples ACROSS the edge (mirror), so the
#    rim shows the backdrop's light, not a painted tint.
#
# Map layout (normalized -1..1, square, sampled on the element box):
#  R = x displacement, G = y displacement, 128 = neutral.
#
#  - mirrorZone: outer band (top/bottom) where the sample point is pulled
#    outward across the edge -- a mirror reflection.
#  - sideZero: left/right bands are exactly 128 (no pull).
#  - cornerPull: inside the corner square the pull vector rotates from the
#    horizontal-edge direction (down/up) toward the vertical-edge direction
#    (left/right) -- the U-bend -- with a height-based fade so tall panels
#    don't pull all the way up the side.
#
# Output: public/panel-lens-map.png  (feImage href in index.html)

from __future__ import annotations

import argparse
import zlib
import struct
from pathlib import Path

N = 256


def smoothstep(u: float) -> float:
    u = max(0.0, min(1.0, u))
    return u * u * (3 - 2 * u)


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def build_map(
    edge: float,
    corner: float,
    height_fade: float,
    mirror_depth: float,
) -> bytes:
    """edge: fraction of half-size that is the rim band (e.g. 0.18).
    corner: fraction of half-size that is the corner square (e.g. 0.22).
    height_fade: rate at which the corner U-pull decays along the vertical edge
      (0 = no fade, 1 = fade to zero at the opposite corner).
    mirror_depth: how far across the edge the mirror samples (0..1).
    """
    img = bytearray(N * N * 4)
    for py in range(N):
        ny = (py + 0.5) / N * 2 - 1  # -1..1
        ay = abs(ny)
        for px in range(N):
            nx = (px + 0.5) / N * 2 - 1
            ax = abs(nx)

            # Chebyshev radius: 0 centre, 1 at the square edge
            r = max(ax, ay)
            dx = 0.0
            dy = 0.0

            # rim band on horizontal edges only
            in_top = ay > 1 - edge and nx != 0
            in_bot = ay > 1 - edge and nx != 0
            in_left = ax > 1 - edge and ny != 0
            in_right = ax > 1 - edge and ny != 0

            # corner squares
            in_corner = ax > 1 - corner and ay > 1 - corner

            if in_corner:
                # U-pull: rotate from horizontal-edge direction to vertical-edge
                # direction across the corner, with height fade.
                cu = (ax - (1 - corner)) / corner  # 0..1 across corner x
                cv = (ay - (1 - corner)) / corner  # 0..1 across corner y
                u = max(cu, cv)

                # horizontal pull (down/up) decays across the corner
                # vertical pull (left/right) grows across the corner
                horiz_pull = (1 - u)
                vert_pull = u

                # height fade: the further from the corner start,
                # the weaker the pull.
                fade = 1.0 - height_fade * u

                # pull direction: horizontal edges pull toward the edge (down/up),
                # corners pull toward the nearest vertical edge (left/right),
                # then the vertical edge pulls up/down toward the corner.
                # At the corner apex both are ~50% (the U-bend).
                if ny > 0:
                    # bottom corner: pull down from bottom edge, then up toward
                    # the vertical edge — the U goes down, right/left, up.
                    corner_dy = ny * horiz_pull * fade  # down
                else:
                    # top corner: pull up from top edge, then down toward the
                    # vertical edge — the U goes up, right/left, down.
                    corner_dy = ny * horiz_pull * fade  # up

                corner_dx = nx * vert_pull * fade  # toward nearest vertical edge

                dx = corner_dx
                dy = corner_dy
            elif in_top or in_bot:
                # horizontal edge mirror: pull outward across the edge
                u = (ay - (1 - edge)) / edge
                pull = smoothstep(u) * mirror_depth
                dy = -ny * pull  # toward the edge
                dx = 0.0
            elif in_left or in_right:
                # vertical edges: zero pull
                dx = 0.0
                dy = 0.0

            # encode: 128 = neutral, 127 = max pull
            r8 = round(128 + dx * 127)
            g8 = round(128 + dy * 127)
            i = (py * N + px) * 4
            img[i] = clamp(r8, 0, 255)
            img[i + 1] = clamp(g8, 0, 255)
            img[i + 2] = 128
            img[i + 3] = 255
    return bytes(img)


def write_png(path: Path, raw: bytes) -> None:
    """Minimal PNG encoder, no dependencies."""

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data))
        )

    ihdr = chunk(
        b"IHDR",
        struct.pack(">IIBBBBB", N, N, 8, 6, 0, 0, 0),
    )
    scanlines = b"".join(
        b"\x00" + raw[y * N * 4 : (y + 1) * N * 4] for y in range(N)
    )
    idat = chunk(b"IDAT", zlib.compress(scanlines, 9))
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + ihdr + idat + chunk(b"IEND", b""))


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--edge", type=float, default=0.18)
    p.add_argument("--corner", type=float, default=0.22)
    p.add_argument("--height-fade", type=float, default=0.55)
    p.add_argument("--mirror-depth", type=float, default=1.0)
    p.add_argument("--out", type=Path, default=Path("public/panel-lens-map.png"))
    args = p.parse_args()
    raw = build_map(args.edge, args.corner, args.height_fade, args.mirror_depth)
    write_png(args.out, raw)
    print(f"wrote {args.out} ({N}x{N})")


if __name__ == "__main__":
    main()
