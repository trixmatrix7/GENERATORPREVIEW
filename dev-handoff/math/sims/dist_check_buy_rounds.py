# -*- coding: utf-8 -*-
# Distribution + max-win reachability of the FINAL calibrated bought rounds
# (Noski: "max win reachable in 3 scatter und 4 scatter, gute verteilung").
import json, random, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from certify_vice_buys_ante import precompute, play_fs_round, SCATTER_PAY, MAX_WIN_X, X  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))

def dist(strips_file, scatters, n, seed):
    strips = json.load(open(os.path.join(HERE, strips_file), encoding='utf-8'))['reelStrips']
    PRE = precompute(strips)
    lens = [len(s) for s in strips]
    rng = random.Random(seed)
    trig_pay = SCATTER_PAY[min(scatters, 5) - 3]
    rounds = []
    cap_hits = 0
    for _ in range(n):
        session = trig_pay
        _, session = play_fs_round(PRE, lens, rng, scatters >= 4, session)
        if session >= MAX_WIN_X * X:
            session = MAX_WIN_X * X
            cap_hits += 1
        rounds.append(session / X)
    rounds.sort()
    q = lambda p: rounds[min(n - 1, int(p * n))]
    ev = sum(rounds) / n
    print('%s (forced %dsc, n=%d):' % (strips_file, scatters, n))
    print('  EV %.2fx | min %.2f | p25 %.1f | median %.1f | p75 %.1f | p90 %.1f | p99 %.1f | p999 %.1f | max %.1f' % (
        ev, rounds[0], q(0.25), q(0.5), q(0.75), q(0.9), q(0.99), q(0.999), rounds[-1]))
    print('  >=100x: %.2f%% | >=500x: %.3f%% | >=1000x: %.3f%% | MAX WIN (5000x) hits: %d (1-in-%s)' % (
        100 * sum(1 for r in rounds if r >= 100) / n,
        100 * sum(1 for r in rounds if r >= 500) / n,
        100 * sum(1 for r in rounds if r >= 1000) / n,
        cap_hits, ('%.0f' % (n / cap_hits)) if cap_hits else 'inf (0 hits)'))

dist('vice_buy3_fs_strips.json', 3, 300000, 991)
dist('vice_buy4_fs_strips.json', 4, 200000, 992)
