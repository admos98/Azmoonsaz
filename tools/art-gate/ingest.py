#!/usr/bin/env python3
"""Ingest the accepted generation batch (2026-10-07) into theme-ready pairs.

Coverage-fit keying adapted from the delivered process.py: every pixel is
modelled as C = a·S + (1−a)·bg with S one of three brand inks (plum stroke /
gold fill / pale wash); coverage a becomes alpha so AA fringes stay soft.
Dark output is a recolor of the same matte, never a re-generation.

Layout: parent regens (01/06) REPLACE public/empty-art/{light,dark}/*.png —
measure.py globs that dir and owns the parents' ≤15% spread band. New
families go to public/empty-art/<family>/{light,dark}/ subdirs so the
parent gate keeps its scope; each family is measured on its own.

Sources are the delivered batch folder — re-point JOBS after any regen.
Usage:  python tools/art-gate/ingest.py [parent|cuts|absence|seal|hero|all]
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt, gaussian_filter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(ROOT, "public", "empty-art")

BATCH = "C:/Users/Moslem/Desktop/picsnew"
JOBS = [
    # family,  source,                                          stem
    ("parent", f"{BATCH}/newer/finals/01-students-r2.png",      "01-students"),
    ("parent", f"{BATCH}/hopefully last latest/finals/06-classes-r1-fixed.png", "06-classes"),
    ("cuts",   f"{BATCH}/cut-1.png", "cut-1"),
    ("cuts",   f"{BATCH}/cut-2.png", "cut-2"),
    ("cuts",   f"{BATCH}/cut-3.png", "cut-3"),
    ("cuts",   f"{BATCH}/cut-4.png", "cut-4"),
    ("cuts",   f"{BATCH}/cut-5.png", "cut-5"),
    ("cuts",   f"{BATCH}/cut-6.png", "cut-6"),
    ("absence", f"{BATCH}/absence/abs-1-404.png",             "abs-1-404"),
    ("absence", f"{BATCH}/absence/abs-2-session-expired.png",  "abs-2-session-expired"),
    ("absence", f"{BATCH}/newer/finals/abs-3-import-failed.png", "abs-3-import-failed"),
    ("absence", f"{BATCH}/newer/finals/abs-4-no-results.png",   "abs-4-no-results"),
    ("seal",   f"{BATCH}/seal.png", "seal"),
    ("hero",   f"{BATCH}/hero.png", "hero"),
]

INK_L = np.array([34, 30, 74], dtype=np.float64)     # #221E4A plum stroke
GOLD_L = np.array([245, 179, 1], dtype=np.float64)   # #F5B301 gold fill
WASH_L = np.array([239, 235, 231], dtype=np.float64) # #EFEFEB wash plane
INK_D = np.array([247, 241, 228], dtype=np.float64)  # #F7F1E4 cream stroke
GOLD_D = np.array([248, 197, 66], dtype=np.float64)  # #F8C542 gold
WASH_D = np.array([50, 47, 71], dtype=np.float64)    # #322F47 plum wash

BG_KEY_DIST = 10.0
MIN_ALPHA = 0.05

# Stroke-weight normalization (docs/art/Azmoonsaz-ART-MASTERPLAN.md §3):
# exact Euclidean morphology on the keyed alpha mask with a per-asset float
# radius, then σ=0.7 re-fringe. EDT distances come in float rings — tune the
# radius in 0.2 steps against tools/art-gate/measure.py, never by eye.
# 01-students regen drew +39% heavier than its siblings (ratio 17.1e-3 vs
# ~12.5 band) — thin it back into the ≤15% spread gate.
STROKE_DELTA = {
    "01-students": 2.0,
}


def normalize_strokes(alpha, best_idx, r):
    """Thin ink strokes by r px of exact-Euclidean ring distance.

    Only the ink class (idx 0) is touched — gold fills and the wash plane
    keep their coverage; the σ=0.7 gaussian restores the anti-alias fringe
    the binary erosion cut off.
    """
    if r <= 0:
        return alpha
    core = (best_idx == 0) & (alpha > 0.5)
    if not core.any():
        return alpha
    edt = distance_transform_edt(core)
    keep = core & (edt > r)
    out = np.where(best_idx == 0, 0.0, alpha)  # drop old ink core + fringe
    out = np.where(keep, alpha, out)           # restore surviving core
    return gaussian_filter(out, 0.7)


def process(src_path, stem, light_dir, dark_dir):
    im = Image.open(src_path).convert("RGB")
    c = np.asarray(im, dtype=np.float64)
    h, w, _ = c.shape

    corners = np.concatenate([
        c[:8, :8].reshape(-1, 3), c[:8, -8:].reshape(-1, 3),
        c[-8:, :8].reshape(-1, 3), c[-8:, -8:].reshape(-1, 3)])
    bg = np.median(corners, axis=0)

    dist_bg = np.sqrt(((c - bg) ** 2).sum(axis=2))
    is_bg = dist_bg < BG_KEY_DIST

    best_res = np.full((h, w), np.inf)
    best_a = np.zeros((h, w))
    best_idx = np.zeros((h, w), dtype=np.int8)
    for idx, s in enumerate((INK_L, GOLD_L, WASH_L)):
        d = bg - s
        denom = float(d @ d)
        a = np.clip(((bg - c) @ d) / denom, 0.0, 1.0)
        pred = bg - a[..., None] * d
        res = np.sqrt(((c - pred) ** 2).sum(axis=2))
        upd = res < best_res
        best_res = np.where(upd, res, best_res)
        best_a = np.where(upd, a, best_a)
        best_idx = np.where(upd, idx, best_idx)

    alpha = np.where(is_bg | (best_a < MIN_ALPHA), 0.0, best_a)
    # snap solid ink/gold cores, keep AA fringe and the wash's soft ramp
    alpha = np.where((best_idx != 2) & (alpha > 0.7), 1.0, alpha)
    alpha = normalize_strokes(alpha, best_idx, STROKE_DELTA.get(stem, 0.0))

    light_rgb = np.stack([INK_L, GOLD_L, WASH_L])[best_idx].astype(np.uint8)
    dark_rgb = np.stack([INK_D, GOLD_D, WASH_D])[best_idx].astype(np.uint8)
    a_u8 = np.round(alpha * 255).astype(np.uint8)

    ys, xs = np.where(alpha > 0.03)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    side = int(max(y1 - y0, x1 - x0) * 1.10)
    cy, cx = (y0 + y1) // 2, (x0 + x1) // 2
    ty0, tx0 = cy - side // 2, cx - side // 2

    def square(arr):
        if arr.ndim == 2:
            out = np.zeros((side, side), dtype=arr.dtype)
        else:
            out = np.zeros((side, side, arr.shape[2]), dtype=arr.dtype)
        sy0, sx0 = max(0, ty0), max(0, tx0)
        dy0, dx0 = max(0, -ty0), max(0, -tx0)
        n = min(side - dy0, arr.shape[0] - sy0), min(side - dx0, arr.shape[1] - sx0)
        out[dy0:dy0 + n[0], dx0:dx0 + n[1]] = arr[sy0:sy0 + n[0], sx0:sx0 + n[1]]
        return out

    for rgb, outdir in ((light_rgb, light_dir), (dark_rgb, dark_dir)):
        os.makedirs(outdir, exist_ok=True)
        rgba = np.dstack([square(rgb), square(a_u8)])
        Image.fromarray(rgba, "RGBA").save(os.path.join(outdir, stem + ".png"))

    cov = 100.0 * (alpha > 0).sum() / (h * w)
    print(f"{stem:24s} bg={bg.astype(int)} side={side} coverage={cov:.1f}%")


def main():
    want = sys.argv[1] if len(sys.argv) > 1 else "all"
    for family, src, stem in JOBS:
        if want not in ("all", family):
            continue
        if family == "parent":
            light, dark = os.path.join(OUT, "light"), os.path.join(OUT, "dark")
        else:
            light = os.path.join(OUT, family, "light")
            dark = os.path.join(OUT, family, "dark")
        process(src, stem, light, dark)


if __name__ == "__main__":
    main()
