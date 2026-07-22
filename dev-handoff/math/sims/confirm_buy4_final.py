# -*- coding: utf-8 -*-
# Final buy4 confirm: p2=300 fixed, p1 in {70, 75, 80} each at 200k rounds —
# pick the one inside 185-190.6 FS-EV (93.5-96% total at 200x) closest to 188.6.
import json, random, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from certify_vice_buys_ante import (  # noqa: E402
    precompute, eval_spin, SCATTER_PAY, MAX_WIN_X, X, REELS,
    FS_COUNT_STICKY, FS_CAP_STICKY, FS_RETRIG,
)

HERE = os.path.dirname(os.path.abspath(__file__))
manifest = json.load(open(os.path.join(HERE, '../src/data/math_vice_heat.json'), encoding='utf-8'))
base_strips = manifest['reelStrips']
LOWS = (6, 7, 8)

def play(PRE, lens, rng, session):
    sticky = set()
    fs_left = FS_COUNT_STICKY
    fs_played = 0
    while fs_left > 0 and fs_played < FS_CAP_STICKY:
        fs_left -= 1
        fs_played += 1
        st = [rng.randrange(lens[r]) for r in range(REELS)]
        for i in range(REELS):
            if len(sticky) >= 4:
                break
            if i not in sticky and PRE[i][st[i]][1] > 0:
                sticky.add(i)
        w2, sc2, _ = eval_spin(PRE, st, False, sticky)
        if len(sticky) >= 4:
            w2 *= 2
        session += w2
        if session >= MAX_WIN_X * X:
            break
        if sc2 >= 3 and fs_played < FS_CAP_STICKY:
            fs_left = min(fs_left + FS_RETRIG, FS_CAP_STICKY - fs_played)
    return session

def pad_reel(strips, reel, n_pad):
    s2 = [list(x) for x in strips]
    s = s2[reel]
    for _ in range(n_pad):
        counts = {sym: s.count(sym) for sym in LOWS}
        mode = min(LOWS, key=lambda sym: (counts[sym], sym))
        s.insert((len(s) // 2) % len(s), mode)
    s2[reel] = s
    return s2

target = 188.6
best = None
N = 200_000
for p1 in (70, 75, 80):
    strips = pad_reel(pad_reel(base_strips, 2, 300), 1, p1)
    PRE = precompute(strips)
    lens = [len(x) for x in strips]
    rng = random.Random(31000 + p1)
    rounds = []
    cap = 0
    for _ in range(N):
        session = play(PRE, lens, rng, SCATTER_PAY[1])
        if session >= MAX_WIN_X * X:
            session = MAX_WIN_X * X
            cap += 1
        rounds.append(session / X)
    rounds.sort()
    ev = sum(rounds) / N
    q = lambda p: rounds[min(N - 1, int(p * N))]
    print('p1=%d: EV %.2fx (total %.2f%%) | median %.1f | p90 %.1f | p99 %.1f | max %.1f | capHits %d (1-in-%.0f)' % (
        p1, ev, (ev + 1.381) / 200 * 100, q(0.5), q(0.9), q(0.99), rounds[-1], cap, N / cap if cap else -1))
    if 185.0 <= ev <= 190.6 and (best is None or abs(ev - target) < abs(best[1] - target)):
        best = (p1, ev, cap, strips, q(0.5), q(0.9), q(0.99))

if best is None:
    print('NONE inside band — nearest reported above; NOT writing.')
else:
    p1, ev, cap, strips, med, p90, p99 = best
    json.dump({
        'rule': 'BOUGHT round only: sticky towerCap 4 + fullBoard x2 while all 4 towers stand; natural strips with reel 2 padded by 300 and reel 1 by %d least-common-low stops (wild+scatter counts per strip unchanged)' % p1,
        'stickyTowerCap': 4,
        'stickyFullBoardMultiplier': 2,
        'reelStrips': strips,
        'evFs': round(ev, 3),
        'rtpPctAt200': round((ev + 1.381) / 200 * 100, 2),
        'capHits1In': round(N / cap) if cap else None,
        'median': med, 'p90': p90, 'p99': p99,
        'rounds': N,
    }, open(os.path.join(HERE, 'vice_buy4_fs_strips_cap4.json'), 'w'), indent=1)
    print('WROTE final: p1=%d EV %.2f (%.2f%% at 200x), capHits 1-in-%.0f' % (p1, ev, (ev + 1.381) / 2, N / cap))
