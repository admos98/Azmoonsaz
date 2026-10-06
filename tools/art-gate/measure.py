#!/usr/bin/env python3
"""Art gate: measure optical stroke weight + fill of every shipped motif.
The six (and any future motif) must stay within a +/-15% stroke/canvas
band or they do not read as one system at slot size. Run after any regen:
    python tools/art-gate/measure.py
Exit 0 = PASS (spread <= 15%), 1 = FAIL.

PALETTE NOTE: the ink mask keys on #221E4A, the legacy plum the shipped
set was keyed with. Live `--color-ink` is #1a1a2e — retarget INK here
(and in process.py's recolor) before any future regeneration round.
"""
import numpy as np
from PIL import Image
import os, glob, sys

HERE = os.path.dirname(os.path.abspath(__file__))
# repo layout: tools/art-gate/measure.py -> public/empty-art/light/*.png
LIGHT = os.path.normpath(os.path.join(HERE, "..", "..", "public", "empty-art", "light"))


def run_lengths(mask):
    v = np.zeros(mask.shape, np.int32)
    h = np.zeros(mask.shape, np.int32)
    for src, dst in ((mask, v), (mask.T, h)):
        for i in range(src.shape[0]):
            row = src[i].view(np.int8)
            d = np.diff(np.concatenate(([0], row, [0])))
            for s, e in zip(np.where(d == 1)[0], np.where(d == -1)[0]):
                dst[i, s:e] = e - s
    return v, h.T


def main():
    rows = []
    for p in sorted(glob.glob(os.path.join(LIGHT, "*.png"))):
        im = np.asarray(Image.open(p).convert("RGBA"))
        a = im[..., 3] > 128
        ink = a & (np.abs(im[..., :3].astype(int) - np.array([34, 30, 74])).sum(axis=2) < 30)
        v, h = run_lengths(ink)
        w = np.minimum(v[ink], h[ink])
        w = w[(w >= 3) & (w <= 40)]
        stroke = np.bincount(w).argmax()
        side = im.shape[0]
        ratio = 1000 * stroke / side
        ys, xs = np.where(a)
        fill = 100 * (xs.max() - xs.min() + 1) / side
        rows.append((os.path.basename(p), stroke, ratio, fill))
    if not rows:
        print(f"art gate: no PNGs found in {LIGHT}")
        return 1
    print(f"{'asset':20s} {'stroke':>6s} {'ratio e-3':>9s} {'fill%':>6s}")
    for name, stroke, ratio, fill in rows:
        print(f"{name:20s} {stroke:6d} {ratio:9.2f} {fill:6.1f}")
    r = np.array([x[2] for x in rows])
    spread = (r.max() / r.min() - 1) * 100
    print(f"\nstroke-weight spread: {spread:.0f}%  "
          f"({'PASS' if spread <= 15 else 'FAIL'} — gate is 15%)")
    return 0 if spread <= 15 else 1


if __name__ == "__main__":
    sys.exit(main())
