#!/usr/bin/env python3
"""Derive the favicon/PWA icon set from the SHIPPED art (Art Master Plan C.6).

Favicon / PWA: the CUT-1 motif on plum #221E4A, gold intact — generated from
public/empty-art/cuts/dark/cut-1.png, never re-rolled. DARK key on purpose:
the plate IS plum, so the light key's plum strokes would vanish into it; the
dark key's cream strokes carry the drawing while its gold stays gold.

Content fractions (the keyed sources carry a ~10% margin already):
  favicon / apple-touch  — large, no OS mask involved beyond iOS rounding
  icon-192 / icon-512    — maskable safe zone: content inside the inner
                           80%-diameter circle, so a smaller fraction

SPLASH: masterplan C.6 specifies SEAL-on-plum as the splash. No host exists
today — a static splash only renders in standalone app mode (iOS
apple-touch-startup-image / Android screen), and enabling app mode is a
product decision, not a favicon rebrand. When a host ships, add a job here:
  ("seal", 1170, 2532, ...) with a stretched plum plate, seal centered.

Run after ANY cut-1/seal regen:  python tools/art-gate/make-icons.py
(or npm run art:icons). Deterministic: same source -> same bytes.
"""
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
PLUM = (34, 30, 74, 255)  # #221E4A

CUT1 = os.path.join(ROOT, "public", "empty-art", "cuts", "dark", "cut-1.png")

# (out, size, content-fraction-of-frame)
JOBS = [
    ("favicon.png", 48, 0.80),
    ("apple-touch-icon.png", 180, 0.72),
    ("icon-192.png", 192, 0.64),
    ("icon-512.png", 512, 0.64),
]


def main():
    src = Image.open(CUT1).convert("RGBA")
    for name, size, frac in JOBS:
        box = int(round(size * frac))
        art = src.resize((box, box), Image.LANCZOS)
        plate = Image.new("RGBA", (size, size), PLUM)
        plate.alpha_composite(art, ((size - box) // 2, (size - box) // 2))
        out = os.path.join(ROOT, "public", name)
        plate.convert("RGBA").save(out)
        print(f"{name:22s} {size}x{size} content={frac:.2f}")


if __name__ == "__main__":
    main()
