#!/usr/bin/env python3
"""Contact-sheet renderer for the art gate: lines every shipped motif up
at 48 / 72 / 112 / 160 px in both themes. If a row doesn't read as one
hand, the asset doesn't ship. Standalone (Pillow only).

    python tools/art-gate/sheet.py [outdir]   # default: tools/art-gate/sheet.png
"""
import os
import sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", "..", "public", "empty-art"))
LIGHT = os.path.join(ROOT, "light")
DARK = os.path.join(ROOT, "dark")
CREAM, NIGHT = (242, 239, 232), (19, 18, 31)
SIZES = [48, 72, 112, 160]
CELL_PAD = 28


def names():
    return sorted(f for f in os.listdir(LIGHT) if f.endswith(".png"))


def build(out):
    files = names()
    n = len(files)
    cell = max(SIZES) + CELL_PAD
    W = n * cell + CELL_PAD
    H = len(SIZES) * 2 * (cell + 12) + CELL_PAD
    sheet = Image.new("RGB", (W, H), CREAM)
    y = CELL_PAD // 2
    for size in SIZES:
        for theme, bg in (("light", CREAM), ("dark", NIGHT)):
            for yy in range(y, y + cell):
                sheet.paste(bg, (0, yy, W, yy + 1))
            for i, f in enumerate(files):
                p = os.path.join(LIGHT if theme == "light" else DARK, f)
                im = Image.open(p).convert("RGBA").resize((size, size), Image.LANCZOS)
                x = CELL_PAD // 2 + i * cell + (cell - size) // 2
                yy = y + (cell - size) // 2
                sheet.paste(im, (x, yy), im)
        y += cell + 12
    sheet.save(out)
    print("sheet ->", out, sheet.size, f"({n} motifs x {len(SIZES)} sizes x 2 themes)")


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "sheet.png"))
