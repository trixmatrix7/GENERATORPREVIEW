# extract-sfx.py — pull the BEST single hit out of a long generated clip.
#
# Suno hands back 20-30s takes where the actual sound happens a few times,
# buried between silence/noise. This finds every distinct event, scores them,
# and exports the best candidates as separate files so we can pick one.
#
# Usage:
#   python scripts/extract-sfx.py "<clip.mp3>" <outdir> [max_len_s] [top_n]
#
# Scoring favours: strong clean transient, good peak, enough decay before the
# next event, and not clipped. Prints a table so the choice is transparent.

import sys, os, subprocess, tempfile
import numpy as np
from scipy import signal
from scipy.io import wavfile

IN = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else "sfx_candidates"
MAXLEN = float(sys.argv[3]) if len(sys.argv) > 3 else 0.65
TOPN = int(sys.argv[4]) if len(sys.argv) > 4 else 3
os.makedirs(OUT, exist_ok=True)

tmp = tempfile.mktemp(suffix=".wav")
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", IN,
                "-ac", "1", "-ar", "48000", tmp], check=True)
sr, x = wavfile.read(tmp)
x = x.astype(np.float32) / 32768.0
dur = len(x) / sr

# Envelope (fast attack tracking, 5ms smoothing)
env = np.abs(signal.hilbert(x))
w = max(1, int(0.005 * sr))
env = np.convolve(env, np.ones(w) / w, mode="same")
peak = env.max() + 1e-12

# Noise floor = 20th percentile of the envelope
floor = np.percentile(env, 20) + 1e-12

# Onsets: envelope rises sharply above the floor
thr = max(floor * 6, peak * 0.12)
above = env > thr
edges = np.diff(above.astype(np.int8))
starts = np.where(edges == 1)[0]
if len(starts) == 0:
    print("no clear events found — clip may be too quiet or continuous")
    sys.exit(1)

# Merge onsets closer than 120ms (same hit)
merged = [starts[0]]
for s in starts[1:]:
    if (s - merged[-1]) / sr > 0.12:
        merged.append(s)

cands = []
for s in merged:
    s0 = max(0, s - int(0.02 * sr))              # 20ms pre-roll
    seg_end = min(len(x), s0 + int(MAXLEN * sr))
    seg = env[s0:seg_end]
    if len(seg) < int(0.05 * sr):
        continue
    p = seg.max()
    if p < peak * 0.25:                          # ignore weak blips
        continue
    # Length = the LAST point still above 6% of this hit's peak. (Using the
    # first dip instead would cut wavering sounds — a goat bleat dips below
    # threshold mid-cry — off after a few frames.)
    live = np.where(seg > p * 0.06)[0]
    length = float(np.clip((live[-1] / sr) if len(live) else MAXLEN, 0.12, MAXLEN))
    # attack sharpness (10%->90% of peak)
    pi = int(np.argmax(seg))
    pre = seg[:pi + 1]
    try:
        a10 = np.where(pre >= 0.1 * p)[0][0]; a90 = np.where(pre >= 0.9 * p)[0][0]
        attack_ms = (a90 - a10) / sr * 1000
    except Exception:
        attack_ms = 999.0
    # headroom before the next event (cleanliness)
    nxt = [m for m in merged if m > s]
    gap = ((nxt[0] - s) / sr) if nxt else (dur - s / sr)
    raw_peak = np.abs(x[s0:seg_end]).max()
    clipped = raw_peak >= 0.999
    # score: loud + sharp attack + room to breathe, penalise clipping
    score = (p / peak) * 2.0 + (1.0 / (1.0 + attack_ms / 20.0)) + min(gap, 1.0) - (1.0 if clipped else 0.0)
    cands.append(dict(start=s0 / sr, length=length, peak_rel=p / peak,
                      attack_ms=attack_ms, gap=gap, clipped=clipped, score=score))

cands.sort(key=lambda c: -c["score"])
print(f"clip {os.path.basename(IN)}  {dur:.1f}s  |  {len(merged)} events, {len(cands)} usable\n")
print(f"{'#':<3}{'start':>8}{'len':>8}{'peak':>8}{'attack':>9}{'gap':>7}  clip")
for i, c in enumerate(cands[:TOPN]):
    print(f"{i+1:<3}{c['start']:>7.2f}s{c['length']:>7.2f}s{c['peak_rel']:>7.0%}"
          f"{c['attack_ms']:>8.1f}ms{c['gap']:>6.2f}s  {'YES' if c['clipped'] else 'no'}")
    fo = max(0.05, c["length"] - 0.12)
    out = os.path.join(OUT, f"cand{i+1}.wav")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp,
                    "-ss", f"{c['start']:.3f}", "-t", f"{c['length']:.3f}",
                    "-af", f"afade=t=in:st=0:d=0.012,afade=t=out:st={fo:.3f}:d=0.1",
                    out], check=True)
print(f"\nwrote {min(TOPN,len(cands))} candidates to {OUT}/")
os.remove(tmp)
