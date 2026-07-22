# -*- coding: utf-8 -*-
# Instrument the buy4 sticky round: what do capped (5000x) rounds look like?
import random, os, sys, collections
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import certify_vice_buys_ante as C
from retune_buy_tails import buy4_strips

CAP_BPS = C.MAX_WIN_X * C.X

strips = buy4_strips(300, 70)
PRE = C.precompute(strips)
lens = [len(s) for s in strips]
rng = random.Random(20260722)
N = 60000
capinfo = []
for _ in range(N):
    session = C.SCATTER_PAY[1]
    sticky = set()
    fs_left, fs_played = 10, 0
    full_at = None
    spins_at_full = 0
    biggest = 0
    big_towers = 0
    while fs_left > 0 and fs_played < 13:
        fs_left -= 1
        fs_played += 1
        st = [rng.randrange(lens[r]) for r in range(C.REELS)]
        for i in range(C.REELS):
            if len(sticky) >= 4:
                break
            if i not in sticky and PRE[i][st[i]][1] > 0:
                sticky.add(i)
        if len(sticky) >= 4 and full_at is None:
            full_at = fs_played
        w2, sc2, _ = C.eval_spin(PRE, st, False, sticky)
        if len(sticky) >= 4:
            w2 *= 2
            spins_at_full += 1
        if w2 > biggest:
            biggest = w2
            big_towers = len(sticky)
        session += w2
        if session >= CAP_BPS:
            break
        if sc2 >= 3 and fs_played < 13:
            fs_left = min(fs_left + C.FS_RETRIG, 13 - fs_played)
    if session >= CAP_BPS:
        capinfo.append((len(sticky), full_at, fs_played, spins_at_full,
                        biggest / C.X, big_towers, sorted(sticky)))

print('cap hits:', len(capinfo), '(1-in-%.0f)' % (N / max(1, len(capinfo))))
print('towers at cap:', collections.Counter(t for t, *_ in capinfo))
print('fullBoard formed spin:', collections.Counter(f for _, f, *_ in capinfo))
print('spins under x2:', collections.Counter(s for *_, s, _b, _t, _st in capinfo))
print('biggest-single-spin towers:', collections.Counter(bt for *_, bt, _s in capinfo))
bs = sorted(b for *_, b, _bt, _s in capinfo)
if bs:
    print('biggest single spin x: med %.0f p10 %.0f p90 %.0f' % (
        bs[len(bs)//2], bs[len(bs)//10], bs[9*len(bs)//10]))
print('sticky sets:', collections.Counter(tuple(s) for *_, s in capinfo).most_common(6))
