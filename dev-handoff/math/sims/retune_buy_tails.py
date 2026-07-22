# -*- coding: utf-8 -*-
# Retune the TAIL SHAPE of the two bought rounds (Noski feedback):
#   - cap-hit (5000x session cap) chance too high in BOTH buys
#   - buy4 must cap STRICTLY more often than buy3
# Keep prices + RTP:
#   buy3 (100x): FS-EV 93.05-95.05  (total 94-96% incl. forced board 0.951x)
#   buy4 (200x): FS-EV 186.62-190.62 (total 94-96% incl. forced board 1.381x)
# Targets: buy3 cap ~1-in-1200..1-in-20000, buy4 ~1-in-600..1-in-1000,
#          buy3 median >= ~8x, buy4 median >= ~60x.
# Levers (per-stage overrides): simulExpandMultipliers (buy3), retriggerSpins,
# freeSpinsCount / fsCap, deterministic strip edits (wild add / low-pad
# dilution; scatter counts NEVER change).
import json, random, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import certify_vice_buys_ante as C
from calibrate_vice_buy_fs_strips import add_wilds, pad_strip

LOWS = (6, 7, 8)
CAP_BPS = C.MAX_WIN_X * C.X


def pad_reel_mid(strips, reel, n_pad):
    """Same deterministic dilution as confirm_buy4_final.pad_reel: insert
    n_pad copies of the currently least common LOW (tie -> lower id,
    recomputed per insertion) at the strip midpoint."""
    s2 = [list(x) for x in strips]
    s = s2[reel]
    for _ in range(n_pad):
        counts = {sym: s.count(sym) for sym in LOWS}
        mode = min(LOWS, key=lambda sym: (counts[sym], sym))
        s.insert((len(s) // 2) % len(s), mode)
    s2[reel] = s
    return s2


def play_buy3(PRE, lens, rng, mults, retrig, fs_count, fs_cap):
    """Forced 3sc expanding round; session seeded with the 3sc scatterPay."""
    session = C.SCATTER_PAY[0]
    empty = set()
    fs_left = fs_count
    fs_played = 0
    while fs_left > 0 and fs_played < fs_cap:
        fs_left -= 1
        fs_played += 1
        st = [rng.randrange(lens[r]) for r in range(C.REELS)]
        w2, sc2, full = C.eval_spin(PRE, st, True, empty)
        w2 *= mults.get(len(full), 1)
        session += w2
        if session >= CAP_BPS:
            break
        if sc2 >= 3 and fs_played < fs_cap:
            fs_left = min(fs_left + retrig, fs_cap - fs_played)
    return session


def play_buy4(PRE, lens, rng, retrig, fs_count, fs_cap,
              tower_cap=4, full_mult=2):
    """Forced 4sc sticky round; session seeded with the 4sc scatterPay."""
    session = C.SCATTER_PAY[1]
    sticky = set()
    fs_left = fs_count
    fs_played = 0
    while fs_left > 0 and fs_played < fs_cap:
        fs_left -= 1
        fs_played += 1
        st = [rng.randrange(lens[r]) for r in range(C.REELS)]
        for i in range(C.REELS):
            if len(sticky) >= tower_cap:
                break
            if i not in sticky and PRE[i][st[i]][1] > 0:
                sticky.add(i)
        w2, sc2, _ = C.eval_spin(PRE, st, False, sticky)
        if len(sticky) >= tower_cap:
            w2 *= full_mult
        session += w2
        if session >= CAP_BPS:
            break
        if sc2 >= 3 and fs_played < fs_cap:
            fs_left = min(fs_left + retrig, fs_cap - fs_played)
    return session


def run(kind, strips, n, seed, **kw):
    PRE = C.precompute(strips)
    lens = [len(s) for s in strips]
    rng = random.Random(seed)
    rounds = []
    cap = 0
    play = play_buy3 if kind == 3 else play_buy4
    for _ in range(n):
        session = play(PRE, lens, rng, **kw)
        if session >= CAP_BPS:
            session = CAP_BPS
            cap += 1
        rounds.append(session / C.X)
    rounds.sort()
    ev = sum(rounds) / n
    q = lambda p: rounds[min(n - 1, int(p * n))]
    return {'ev': ev, 'cap': cap, 'capIn': (n / cap) if cap else None,
            'median': q(0.5), 'p90': q(0.9), 'p99': q(0.99),
            'p999': q(0.999), 'max': rounds[-1], 'n': n}


def show(tag, r):
    cap_s = ('1-in-%.0f' % r['capIn']) if r['cap'] else 'none'
    print('%s: EV %.2fx | med %.1f | p90 %.1f | p99 %.1f | p999 %.1f | '
          'max %.1f | cap %d (%s)' % (tag, r['ev'], r['median'], r['p90'],
          r['p99'], r['p999'], r['max'], r['cap'], cap_s), flush=True)


def buy3_strips(add_spec, pads=()):
    s, _ = add_wilds(C.STRIPS, add_spec)
    for reel, n_pad in pads:
        s, _ = pad_strip(s, reel, n_pad)
    return s


def buy4_strips(p2, p1, add_spec=None, p3=0, p4=0, p0=0):
    s = C.STRIPS
    if add_spec:
        s, _ = add_wilds(s, add_spec)
    s = pad_reel_mid(pad_reel_mid(s, 2, p2), 1, p1)
    if p3:
        s = pad_reel_mid(s, 3, p3)
    if p4:
        s = pad_reel_mid(s, 4, p4)
    if p0:
        s = pad_reel_mid(s, 0, p0)
    return s


if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'sweep3'
    N = int(os.environ.get('RT_N', '50000'))

    if mode == 'sweep3':
        # Stage 1: current strips, drop the simul-4 multiplier
        cur = buy3_strips([1, 0, 0, 0, 1], [(4, 1)])
        for s4 in (10, 6, 5, 4, 3):
            r = run(3, cur, N, 300 + s4, mults={3: 2, 4: s4},
                    retrig=3, fs_count=7, fs_cap=10)
            show('buy3 cur simul4=%d' % s4, r)

    elif mode == 'sweep3b':
        # Stage 2: recover EV with wild adds at low simul4
        for s4 in (4, 5):
            for spec, pads, tag in (
                ([1, 1, 0, 0, 1], (), 'add11001'),
                ([1, 0, 1, 0, 1], (), 'add10101'),
                ([2, 0, 0, 0, 1], (), 'add20001'),
                ([1, 0, 0, 1, 1], (), 'add10011'),
                ([1, 1, 1, 1, 1], (), 'add11111'),
            ):
                strips = buy3_strips(spec, pads)
                r = run(3, strips, N, 500 + s4 * 37 + hash(tag) % 97,
                        mults={3: 2, 4: s4}, retrig=3, fs_count=7, fs_cap=10)
                show('buy3 %s simul4=%d' % (tag, s4), r)

    elif mode == 'sweep4':
        # (retrig, fsCap, p2, p1) — trim tail via session length, recover EV
        # via less dilution
        for retrig, cap, p2, p1 in (
            (3, 13, 300, 70),   # current baseline
            (2, 13, 300, 70),
            (1, 13, 300, 70),
            (3, 12, 300, 70),
            (2, 12, 300, 70),
            (2, 13, 250, 70),
            (1, 13, 250, 50),
            (2, 12, 220, 50),
        ):
            strips = buy4_strips(p2, p1)
            r = run(4, strips, N, 700 + retrig * 131 + cap * 17 + p2 + p1,
                    retrig=retrig, fs_count=10, fs_cap=cap)
            show('buy4 rt=%d cap=%d p2=%d p1=%d' % (retrig, cap, p2, p1), r)

    elif mode == 'grid':
        # generic: kind then comma specs, e.g.
        #   grid 3 spec=1,1,0,0,1 pad=4:1 s4=4 rt=3 fc=7 cap=10
        #   grid 4 p2=260 p1=60 rt=2 cap=12
        kind = int(sys.argv[2])
        kv = dict(a.split('=') for a in sys.argv[3:])
        seed = int(kv.get('seed', '4242'))
        n = int(kv.get('n', str(N)))
        if kind == 3:
            spec = [int(x) for x in kv['spec'].split(',')]
            pads = []
            if 'pad' in kv:
                pr, pn = kv['pad'].split(':')
                pads.append((int(pr), int(pn)))
            strips = buy3_strips(spec, pads)
            r = run(3, strips, n, seed,
                    mults={3: int(kv.get('s3', '2')), 4: int(kv['s4'])},
                    retrig=int(kv.get('rt', '3')),
                    fs_count=int(kv.get('fc', '7')),
                    fs_cap=int(kv.get('cap', '10')))
            show('buy3 %s' % ' '.join(sys.argv[3:]), r)
        else:
            add_spec = ([int(x) for x in kv['add'].split(',')]
                        if 'add' in kv else None)
            strips = buy4_strips(int(kv['p2']), int(kv['p1']), add_spec,
                                 int(kv.get('p3', '0')), int(kv.get('p4', '0')),
                                 int(kv.get('p0', '0')))
            r = run(4, strips, n, seed,
                    retrig=int(kv.get('rt', '3')),
                    fs_count=int(kv.get('fc', '10')),
                    fs_cap=int(kv.get('cap', '13')))
            show('buy4 %s' % ' '.join(sys.argv[3:]), r)

    if mode == 'final3':
        # args: pad4 n seed  — spec/simul fixed to the retuned choice
        pad4 = int(sys.argv[2])
        n = int(sys.argv[3])
        seed = int(sys.argv[4])
        spec = [1, 0, 0, 1, 1]
        strips = buy3_strips(spec, [(4, pad4)])
        mults = {3: 2, 4: 6}
        r = run(3, strips, n, seed, mults=mults, retrig=3, fs_count=7,
                fs_cap=10)
        show('FINAL buy3 pad4=%d' % pad4, r)
        json.dump({
            'reelStrips': strips,
            'overrides': {
                'simulExpandMultipliers': {'3': 2, '4': 6},
            },
            'rule': ('buy3 BOUGHT round only: simulExpandMultipliers override '
                     '{3:2, 4:6} (natural {3:2,4:10} untouched); FS strips = '
                     'natural strips + 1 wild added on reels 0, 3 and 4 '
                     '(replacing the currently most common LOW 6/7/8, '
                     'tie->lower id, at the stop nearest evenly spread '
                     'targets around the existing wild / reel 0: its '
                     'scatter), then reel 4 evenly padded with %d '
                     'least-common-LOW stops (wild+scatter COUNTS unchanged '
                     'except the deliberate wild adds; scatter counts NEVER '
                     'change). retrigger +3, 7 spins cap 10 as natural.'
                     % pad4),
            'evFs': round(r['ev'], 3),
            'rtpPctAt100': round((r['ev'] + 0.951), 2),
            'capHits1In': round(n / r['cap']) if r['cap'] else None,
            'median': r['median'], 'p90': r['p90'], 'p99': r['p99'],
            'p999': r['p999'], 'max': r['max'],
            'rounds': n,
        }, open(os.path.join(HERE, 'vice_buy3_final.json'), 'w'), indent=1)
        print('wrote vice_buy3_final.json', flush=True)

    if mode == 'final4':
        # args: p2 p1 n seed
        p2 = int(sys.argv[2])
        p1 = int(sys.argv[3])
        n = int(sys.argv[4])
        seed = int(sys.argv[5])
        strips = buy4_strips(p2, p1, [0, 1, 0, 0, 0])
        r = run(4, strips, n, seed, retrig=3, fs_count=10, fs_cap=13)
        show('FINAL buy4 p2=%d p1=%d' % (p2, p1), r)
        json.dump({
            'reelStrips': strips,
            'overrides': {
                'stickyTowerCap': 4,
                'stickyFullBoardMultiplier': 2,
            },
            'rule': ('buy4 BOUGHT round only: sticky towerCap 4 + fullBoard '
                     'x2 while all 4 towers stand (unchanged); FS strips = '
                     'natural strips + 1 wild added on reel 1 (replacing the '
                     'currently most common LOW, tie->lower id, nearest the '
                     'evenly spread target around its existing wild), then '
                     'reel 2 padded with %d and reel 1 with %d '
                     'least-common-LOW stops at the strip midpoint '
                     '(recomputed per insertion). Reel 2 becomes the single '
                     'ultra-rare full-board gate (tail), reels 1/3/4 carry '
                     'the body. Scatter counts NEVER change. retrigger +3, '
                     '10 spins cap 13 as natural.' % (p2, p1)),
            'evFs': round(r['ev'], 3),
            'rtpPctAt200': round((r['ev'] + 1.381) / 2, 2),
            'capHits1In': round(n / r['cap']) if r['cap'] else None,
            'median': r['median'], 'p90': r['p90'], 'p99': r['p99'],
            'p999': r['p999'], 'max': r['max'],
            'rounds': n,
        }, open(os.path.join(HERE, 'vice_buy4_final.json'), 'w'), indent=1)
        print('wrote vice_buy4_final.json', flush=True)

    print('DONE', flush=True)
