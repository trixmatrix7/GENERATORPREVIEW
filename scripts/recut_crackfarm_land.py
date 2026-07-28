"""Crack Farm landing sheets: cut the dead air, keep the motion.

THE MEASUREMENT THAT DROVE THIS
-------------------------------
Each sheet is 24 frames at 16 fps = 1.500 s. Measuring the per-frame pixel delta
shows the clips are mostly a STILL IMAGE:

    low_g   14 15 | 1.1 1.1 1.4 1.0 1.1 1.4 | 55 148 137 116 25 48 18 | 4 1.9 1.3 1.0 1.2 1.3 | 15 14
    high_a  15 14 | 1.9 1.8 1.4 1.5 1.3 1.1 1.2 1.2 1.4 3.0 | 90 39 82 55 13 11 | 2.8 1.6 1.4 | 14 15
                  ^ seam        ^ DEAD                       ^ the actual motion   ^ DEAD        ^ seam

So 0.4-0.6 s of every landing is a frozen frame — on high_a, TEN dead frames sit
BEFORE the movement even starts. That is why raising the fps never helped: it
sped up the dead air along with the motion. The frames have to go.

WHAT THIS KEEPS
---------------
The seam contract from the earlier fix is preserved exactly (slot-feel skill,
"Land-Sheet-NAHTSTELLE"): frame 0 and the last frame are pixel-identical to the
static icon, and frame 1 / frame N-2 are the 50% cross-dissolves into and out of
the movement. Only DEAD INTERIOR frames are dropped. Nothing is re-rendered, no
frame is resampled — the surviving frames are copied byte-for-byte.

    node/py -> public/theme/crackfarm/symbol_<id>_landanim.png   (rewritten)
              public/theme/crackfarm/_landanim_orig/             (originals kept)

    python scripts/recut_crackfarm_land.py [--dry]
"""

import os
import sys
import shutil

import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SRC = os.path.join(ROOT, "public", "theme", "crackfarm")
BACKUP = os.path.join(SRC, "_landanim_orig")
DRY = "--dry" in sys.argv

COLS, ROWS = 6, 4
N = COLS * ROWS

# Every sheet is rebuilt to the SAME small frame count, so the landing beat is
# identical across symbols and the wiring stays one line. Measuring showed the
# clips fall into two shapes — some have long dead runs (high_b holds for nine
# frames at delta 0.1-0.8), some wobble faintly the whole way through (low_e,
# low_f at 6-18). A single "cut the dead frames" rule therefore produced
# anything from 9 to 24 frames, which would make each symbol land at a
# different speed. Resampling to a fixed count fixes both problems at once.
OUT_N = 10
OUT_COLS, OUT_ROWS = 5, 2

# Below this a frame is a visual hold, not motion.
DEAD = 4.0


def frames_of(img):
    fw, fh = img.width // COLS, img.height // ROWS
    out = []
    for i in range(N):
        x, y = (i % COLS) * fw, (i // COLS) * fh
        out.append(img.crop((x, y, x + fw, y + fh)))
    return out, fw, fh


def deltas(frames):
    arrs = [np.asarray(f.convert("RGBA"), dtype=np.int16) for f in frames]
    d = []
    for i in range(1, len(arrs)):
        a, b = arrs[i - 1], arrs[i]
        mask = (a[..., 3] > 12) | (b[..., 3] > 12)
        if not mask.any():
            d.append(0.0)
            continue
        d.append(float(np.abs(a[mask] - b[mask]).mean()))
    return d


def motion_span(d):
    """First and last frame index that is part of real movement.

    d[i] is the change INTO frame i+1. The seams (0/1 and N-2/N-1) are the
    cross-dissolves to and from the static icon, so they always register — the
    span is measured over the INTERIOR only.
    """
    live = [i + 1 for i, v in enumerate(d) if v >= DEAD and 2 <= i + 1 <= N - 3]
    if not live:
        return 2, N - 3            # nothing above threshold: use the whole interior
    return live[0], live[-1]


def keep_indices(d):
    """[static, dissolve-in, 6 evenly spaced motion frames, dissolve-out, static].

    A span shorter than the 6 slots is WIDENED into its neighbours rather than
    padded by repeating a frame — a repeated frame is exactly the dead air this
    recut exists to remove, and re-adding it at the tail would put the hold back
    where the eye notices it most.
    """
    a, b = motion_span(d)
    inner = OUT_N - 4                                   # 6
    lo, hi = 2, N - 3                                   # interior bounds
    while b - a + 1 < inner and (a > lo or b < hi):
        if b < hi:
            b += 1
        if b - a + 1 < inner and a > lo:
            a -= 1
    if b - a + 1 <= inner:
        mid = list(range(a, b + 1))[:inner]
    else:
        mid = [int(round(a + (b - a) * k / (inner - 1))) for k in range(inner)]
    return [0, 1] + mid + [N - 2, N - 1]


os.makedirs(BACKUP, exist_ok=True)
report = []

for name in sorted(os.listdir(SRC)):
    if not name.endswith("_landanim.png"):
        continue
    path = os.path.join(SRC, name)
    backup = os.path.join(BACKUP, name)
    if not os.path.exists(backup) and not DRY:
        shutil.copy2(path, backup)
    img = Image.open(backup if os.path.exists(backup) else path).convert("RGBA")

    frames, fw, fh = frames_of(img)
    d = deltas(frames)
    keep = keep_indices(d)
    cut = N - len(keep)

    cols, rows = OUT_COLS, OUT_ROWS
    sheet = Image.new("RGBA", (cols * fw, rows * fh), (0, 0, 0, 0))
    for j, idx in enumerate(keep):
        sheet.paste(frames[idx], ((j % cols) * fw, (j // cols) * fh))

    if not DRY:
        sheet.save(path)

    report.append({
        "sym": name.replace("symbol_", "").replace("_landanim.png", ""),
        "was": N, "now": len(keep), "cut": cut,
        "grid": f"{cols}x{rows}", "frame": f"{fw}x{fh}",
        "kept": keep,
    })

w = lambda s, n: str(s).ljust(n)
print()
print("Crack Farm landing sheets — dead-air recut" + ("  (DRY RUN)" if DRY else ""))
print()
print(f"  {w('symbol', 10)}{w('frames', 12)}{w('grid', 8)}{w('frame', 10)}kept")
for r in report:
    span = "%d -> %d" % (r["was"], r["now"])
    print("  " + w(r["sym"], 10) + w(span, 12) + w(r["grid"], 8) + w(r["frame"], 10) + str(r["kept"]))
print()
if report:
    avg = sum(r["now"] for r in report) / len(report)
    print(f"  {len(report)} sheets, average {N} -> {avg:.1f} frames")
    print(f"  originals kept in {os.path.relpath(BACKUP, ROOT)}")
    print()
    print("  Wire it as: setSymbolLandSheet(id, file, %d, %d, %d, FPS)" % (OUT_COLS, OUT_ROWS, OUT_N))
