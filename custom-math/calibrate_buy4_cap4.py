# -*- coding: utf-8 -*-
# Buy-4sc v2: the BOUGHT sticky round gets towerCap 4 (opens the ceiling so
# the 5000x max win is reachable — cap 3 tops out ~1400x even natural),
# then reel-dilution brings the EV back to ~189x (95% at the 200x price).
import json, random, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from certify_vice_buys_ante import (  # noqa: E402
    precompute, eval_spin, SCATTER_PAY, MAX_WIN_X, X, REELS,
    FS_COUNT_STICKY, FS_CAP_STICKY, FS_RETRIG, STICKY_FULL_MULT,
)

HERE = os.path.dirname(os.path.abspath(__file__))
manifest = json.load(open(os.path.join(HERE, '../src/data/math_vice_heat.json'), encoding='utf-8'))
base_strips = manifest['reelStrips']
LOWS = (6, 7, 8)

def play_sticky_cap(PRE, lens, rng, session, tower_cap, full_mult=1):
    sticky = set()
    fs_left = FS_COUNT_STICKY
    fs_played = 0
    while fs_left > 0 and fs_played < FS_CAP_STICKY:
        fs_left -= 1
        fs_played += 1
        st = [rng.randrange(lens[r]) for r in range(REELS)]
        for i in range(REELS):
            if len(sticky) >= tower_cap:
                break
            if i not in sticky and PRE[i][st[i]][1] > 0:
                sticky.add(i)
        w2, sc2, _ = eval_spin(PRE, st, False, sticky)
        if len(sticky) >= tower_cap:
            w2 *= full_mult
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
        step = max(1, len(s) // (n_pad + 1))
        s.insert((len(s) // 2) % len(s), mode)
    s2[reel] = s
    return s2

def run(strips, n, seed, full_mult=1):
    PRE = precompute(strips)
    lens = [len(x) for x in strips]
    rng = random.Random(seed)
    rounds = []
    cap = 0
    for _ in range(n):
        session = play_sticky_cap(PRE, lens, rng, SCATTER_PAY[1], 4, full_mult)
        if session >= MAX_WIN_X * X:
            session = MAX_WIN_X * X
            cap += 1
        rounds.append(session / X)
    rounds.sort()
    ev = sum(rounds) / n
    return ev, cap, rounds

SEARCH_V3 = False
SEARCH_V4 = True
if SEARCH_V4:
    target = 188.6
    best = None
    for p2 in (300, 400, 500):
        for p1 in (80, 160, 260):
            strips = pad_reel(pad_reel(base_strips, 2, p2), 1, p1)
            e, c, _ = run(strips, 40000, 7000 + p2 + p1, full_mult=2)
            print('v4 p2=%d p1=%d: EV %.1fx capHits %d' % (p2, p1, e, c))
            if best is None or abs(e - target) < abs(best[2] - target):
                best = (p2, p1, e)
    p2, p1, _ = best
    for dp1 in (-40, -20, 20, 40):
        q1 = p1 + dp1
        if q1 <= 0: continue
        strips = pad_reel(pad_reel(base_strips, 2, p2), 1, q1)
        e, c, _ = run(strips, 50000, 8000 + q1, full_mult=2)
        print('v4 fine p2=%d p1=%d: EV %.1fx capHits %d' % (p2, q1, e, c))
        if abs(e - target) < abs(best[2] - target):
            best = (p2, q1, e)
    p2, p1, _ = best
    strips = pad_reel(pad_reel(base_strips, 2, p2), 1, p1)
    ev, cap, rounds = run(strips, 200000, 9999, full_mult=2)
    n = len(rounds)
    qq = lambda pp: rounds[min(n - 1, int(pp * n))]
    print('CONFIRM v4 p2=%d p1=%d: EV %.2fx | median %.1f | p90 %.1f | p99 %.1f | p999 %.1f | max %.1f | capHits %d (1-in-%s)' % (
        p2, p1, ev, qq(0.5), qq(0.9), qq(0.99), qq(0.999), rounds[-1], cap, ('%.0f' % (n / cap)) if cap else 'inf'))
    import json as J
    J.dump({
        'rule': 'BOUGHT round only: sticky towerCap 4 + fullBoard x2 while all 4 towers stand; natural strips with reel 2 padded by %d and reel 1 by %d least-common-low stops (wild+scatter counts per strip unchanged)' % (p2, p1),
        'stickyTowerCap': 4,
        'stickyFullBoardMultiplier': 2,
        'reelStrips': strips,
        'evFs': round(ev, 3),
        'rtpPctAt200': round((ev + 1.381) / 200 * 100, 2),
        'capHits1In': round(n / cap) if cap else None,
        'rounds': n,
    }, open(os.path.join(HERE, 'vice_buy4_fs_strips_cap4.json'), 'w'), indent=1)
    print('wrote vice_buy4_fs_strips_cap4.json (v4)')
    raise SystemExit(0)

if SEARCH_V3:
    target = 188.6
    best = None
    for n_pad in (350, 450, 550, 650, 800):
        strips = pad_reel(base_strips, 2, n_pad)
        e, c, _ = run(strips, 50000, 900 + n_pad, full_mult=2)
        print('fm2 pad n=%d: EV %.1fx capHits %d' % (n_pad, e, c))
        if best is None or abs(e - target) < abs(best[1] - target):
            best = (n_pad, e)
    for np2 in (best[0] - 60, best[0] - 30, best[0] + 30, best[0] + 60):
        if np2 <= 0: continue
        strips = pad_reel(base_strips, 2, np2)
        e, c, _ = run(strips, 50000, 1500 + np2, full_mult=2)
        print('fm2 fine n=%d: EV %.1fx capHits %d' % (np2, e, c))
        if abs(e - target) < abs(best[1] - target):
            best = (np2, e)
    n_pad = best[0]
    strips = pad_reel(base_strips, 2, n_pad)
    ev, cap, rounds = run(strips, 200000, 4321, full_mult=2)
    n = len(rounds)
    q = lambda p: rounds[min(n - 1, int(p * n))]
    print('CONFIRM fm2 pad=%d: EV %.2fx | median %.1f | p90 %.1f | p99 %.1f | p999 %.1f | max %.1f | capHits %d (1-in-%s)' % (
        n_pad, ev, q(0.5), q(0.9), q(0.99), q(0.999), rounds[-1], cap, ('%.0f' % (n / cap)) if cap else 'inf'))
    import json as J
    J.dump({
        'rule': 'BOUGHT round only: sticky towerCap 4 + fullBoard x2 while all 4 towers stand; natural strips with reel 2 padded by %d least-common-low stops (wild+scatter counts unchanged)' % n_pad,
        'stickyTowerCap': 4,
        'stickyFullBoardMultiplier': 2,
        'reelStrips': strips,
        'evFs': round(ev, 3),
        'rtpPctAt200': round((ev + 1.381) / 200 * 100, 2),
        'capHits1In': round(n / cap) if cap else None,
        'rounds': n,
    }, open(os.path.join(HERE, 'vice_buy4_fs_strips_cap4.json'), 'w'), indent=1)
    print('wrote vice_buy4_fs_strips_cap4.json (v3 fm2)')
    raise SystemExit(0)

# 1. Level check cap4 on natural strips
ev, cap, _ = run(base_strips, 60000, 11)
print('cap4 natural: EV %.1fx capHits %d' % (ev, cap))

# 2. Dilution sweep on reel 2 (and reel 1 if needed) to reach EV ~189
target = 188.6
best = None
for n_pad in (60, 100, 150, 200, 260, 320):
    strips = pad_reel(base_strips, 2, n_pad)
    e, c, _ = run(strips, 50000, 100 + n_pad)
    print('pad reel2 n=%d: EV %.1fx capHits %d' % (n_pad, e, c))
    if best is None or abs(e - target) < abs(best[1] - target):
        best = (n_pad, e)

n_pad = best[0]
# fine steps around best
for np2 in (n_pad - 30, n_pad - 15, n_pad + 15, n_pad + 30):
    if np2 <= 0: continue
    strips = pad_reel(base_strips, 2, np2)
    e, c, _ = run(strips, 50000, 500 + np2)
    print('fine n=%d: EV %.1fx capHits %d' % (np2, e, c))
    if abs(e - target) < abs(best[1] - target):
        best = (np2, e)

# 3. Confirm best at 200k + distribution
n_pad = best[0]
strips = pad_reel(base_strips, 2, n_pad)
ev, cap, rounds = run(strips, 200000, 777)
n = len(rounds)
q = lambda p: rounds[min(n - 1, int(p * n))]
print('CONFIRM pad=%d: EV %.2fx | median %.1f | p90 %.1f | p99 %.1f | p999 %.1f | max %.1f | capHits %d (1-in-%s)' % (
    n_pad, ev, q(0.5), q(0.9), q(0.99), q(0.999), rounds[-1], cap, ('%.0f' % (n / cap)) if cap else 'inf'))
json.dump({
    'rule': 'sticky round with towerCap 4 (BOUGHT round only); natural strips with reel 2 padded by %d least-common-low stops (wild+scatter counts unchanged)' % n_pad,
    'stickyTowerCap': 4,
    'reelStrips': strips,
    'evFs': round(ev, 3),
    'rtpPctAt200': round((ev + 1.381) / 200 * 100, 2),
    'capHits1In': round(n / cap) if cap else None,
    'rounds': n,
}, open(os.path.join(HERE, 'vice_buy4_fs_strips_cap4.json'), 'w'), indent=1)
print('wrote vice_buy4_fs_strips_cap4.json')
