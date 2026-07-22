# -*- coding: utf-8 -*-
# EV of the FORCED buy board itself (settlement evaluates it in full):
# windows conditioned to exactly-1 scatter on k reels / 0 on the rest,
# ways line wins + the k-scatter scatterPay. Mirrors mockHost.forceScatterStops
# (stops slide forward to the nearest window matching the target count).
import json, random, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from certify_vice_buys_ante import precompute, eval_spin, SC, REELS  # noqa: E402

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
manifest = json.load(open(os.path.join(ROOT, 'src/data/math_vice_heat.json'), encoding='utf-8'))
strips = manifest['reelStrips']
PRE = precompute(strips)
lens = [len(s) for s in strips]
ROWS = 5

def win_count(reel, stop):
    return sum(1 for row in range(ROWS) if strips[reel][(stop + row) % lens[reel]] == SC)

def force(stops, order, k):
    out = list(stops)
    scatter_reels = set(order[:k])
    for reel in range(REELS):
        target = 1 if reel in scatter_reels else 0
        for off in range(lens[reel]):
            pos = (stops[reel] + off) % lens[reel]
            if win_count(reel, pos) == target:
                out[reel] = pos
                break
    return out

rng = random.Random(7)
N = 400_000
for k in (3, 4):
    total = 0
    for _ in range(N):
        stops = [rng.randrange(lens[r]) for r in range(REELS)]
        order = list(range(REELS))
        rng.shuffle(order)
        f = force(stops, order, k)
        win, sc, _full = eval_spin(PRE, f, False, set())
        assert sc == k, (sc, k)
        total += win
    print('k=%d forcedBoardEV %.4fx (n=%d, incl. %d-scatter pay)' % (k, total / N, N, k))
