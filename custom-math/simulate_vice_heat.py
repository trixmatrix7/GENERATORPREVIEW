# Vice Heat — custom math model simulator (dev-structure compliant)
# 5x5 (or 5x3 via VH_ROWS), ways pays, ALL symbols pay from 3-of-a-kind,
# wilds on reels 2-5 only (reel 1 clean => no wild-line double counting).
#
# TIERED FREE-SPINS BONUS:
#   3 scatters  -> per-spin expanding wilds (every landed wild expands to a
#                  full wild reel for THAT spin only)
#   4+ scatters -> STICKY expanding wilds (an expanded reel stays fully wild
#                  for the REST of the round; towers accumulate)
# HOT SPIN (base): 1-in-HOT_CHANCE spins play in per-spin expansion mode
# (the "screen darkens" special spin). Session cap 5000x. Target 96.00% RTP.
#
# Expanded reels show ONLY wilds -> they contribute NO scatters (matches the
# preview MockHost, which overwrites the board before evaluation), so
# retriggers get naturally rarer as towers accumulate.
#
# Pays are defined RELATIVELY; a single linear scale factor k is fitted so
# total RTP = 96.00% (every pay component scales linearly with k), then the
# final integer-bps paytable is re-simulated for certification.

import random, json, sys, os

REELS, ROWS = 5, int(os.environ.get('VH_ROWS', '5'))
W, SC = 0, 1
SYMS = [2, 3, 4, 5, 6, 7, 8]  # A B C D E F G

# ── strips (40 stops each) ──────────────────────────────────────────────────
def build_strip(counts):
    s = []
    for sym, n in counts.items():
        s += [sym] * n
    assert len(s) == 40, len(s)
    random.Random(1337 + len(s) + sum(counts.values())).shuffle(s)
    return s

if ROWS == 5:
    # 5x5 VOLATILE structure: RARE wilds (1 per strip on reels 2-5 — an
    # expansion is an EVENT, not the norm), leaner scatters, FS 8.
    STRIPS = [
        build_strip({SC: 1, 2: 4, 3: 4, 4: 5, 5: 5, 6: 7, 7: 7, 8: 7}),        # R1: no wild
        build_strip({W: 1, SC: 1, 2: 4, 3: 4, 4: 5, 5: 5, 6: 6, 7: 7, 8: 7}),  # R2
        build_strip({W: 1, SC: 2, 2: 4, 3: 4, 4: 5, 5: 5, 6: 6, 7: 6, 8: 7}),  # R3
        build_strip({W: 1, SC: 1, 2: 4, 3: 4, 4: 5, 5: 5, 6: 6, 7: 7, 8: 7}),  # R4
        build_strip({W: 1, SC: 1, 2: 4, 3: 4, 4: 5, 5: 5, 6: 7, 7: 6, 8: 7}),  # R5
    ]
else:
    STRIPS = [
        build_strip({SC: 2, 2: 3, 3: 4, 4: 5, 5: 5, 6: 7, 7: 7, 8: 7}),        # R1: no wild
        build_strip({W: 2, SC: 2, 2: 3, 3: 4, 4: 5, 5: 5, 6: 6, 7: 6, 8: 7}),  # R2
        build_strip({W: 3, SC: 2, 2: 3, 3: 4, 4: 4, 5: 5, 6: 6, 7: 6, 8: 7}),  # R3
        build_strip({W: 3, SC: 2, 2: 3, 3: 4, 4: 5, 5: 5, 6: 6, 7: 6, 8: 6}),  # R4
        build_strip({W: 2, SC: 2, 2: 3, 3: 4, 4: 5, 5: 5, 6: 6, 7: 7, 8: 6}),  # R5
    ]

# ── relative paytable (bps of total bet per way, [3,4,5]) ───────────────────
# STEEP curve: 3-oaks are pocket change, 5-oaks are events — a fully expanded
# sticky board (4 towers + a premium reel-1 window) stacks toward MAX WIN
# within its own round. That's where the volatility lives.
BASE_PAYS = {
    2: [40, 300, 3000],
    3: [30, 220, 1800],
    4: [22, 150, 1000],
    5: [18, 120, 800],
    6: [14, 80, 450],
    7: [12, 60, 350],
    8: [10, 50, 250],
}
SCATTER_PAY = [100, 400, 2000]   # 3/4/5 scatters, x total bet bps
# Retrigger awards a FULL freeSpinsCount again (contract/mock parity — the
# template's SlotGame.sol re-awards freeSpinsCount, not a separate amount).
# TIGHT total cap: max win must come from the SETUP (early towers), never
# from grinding endless retriggered spins.
FS_COUNT, FS_CAP = (8 if ROWS == 5 else 10), 16
HOT_CHANCE = 40                   # 1-in-40 base spins are HOT (expansion mode)
MAX_WIN_X = 5000
# Sticky rounds: the first N wild-landing reels become permanent towers
# (leftmost joins first on ties). Default = ALL wild-capable reels (4) — with
# RARE wilds the full board is the jackpot event, not the norm.
STICKY_CAP = int(os.environ.get('VH_STICKY_CAP', '4'))

# ── precompute visible windows per reel/stop: (counts per symbol incl. wild-as-any, wilds, scatters)
def precompute(strips):
    pre = []
    for strip in strips:
        L = len(strip)
        rows = []
        for stop in range(L):
            win = [strip[(stop + r) % L] for r in range(ROWS)]
            wilds = win.count(W)
            scat = win.count(SC)
            cnt = {}
            for s in SYMS:
                cnt[s] = win.count(s) + wilds
            rows.append((cnt, wilds, scat))
        pre.append(rows)
    return pre

PRE = precompute(STRIPS)


def eval_spin(stops, per_spin_expand, sticky_set, pays, scatter_pay):
    """Returns (line_win_bps, scatters, full_wild_reels).

    per_spin_expand: reels whose window carries a wild become fully wild for
    this spin. sticky_set: reels ALREADY fully wild (sticky towers). Fully
    wild reels contribute NO scatters (they show only wilds)."""
    data = [PRE[i][stops[i]] for i in range(REELS)]
    full = set(sticky_set)
    if per_spin_expand:
        for i in range(REELS):
            if data[i][1] > 0:
                full.add(i)
    scatters = sum(d[2] for i, d in enumerate(data) if i not in full)
    win = 0
    for s in SYMS:
        ways = 1
        k = 0
        for i in range(REELS):
            n = ROWS if i in full else data[i][0][s]
            if n == 0:
                break
            ways *= n
            k += 1
        if k >= 3:
            win += pays[s][k - 3] * ways
    if scatters >= 3:
        win += scatter_pay[min(scatters, 5) - 3]
    return win, scatters, full


def pct(sorted_xs, q):
    if not sorted_xs: return 0.0
    i = min(len(sorted_xs) - 1, int(q * len(sorted_xs)))
    return sorted_xs[i]


def simulate(n, pays, scatter_pay, seed=42):
    rng = random.Random(seed)
    lens = [len(s) for s in STRIPS]
    total = 0
    hits = 0
    base_total = 0; fs3_total = 0; fs4_total = 0; hot_total = 0
    fs3_rounds = []; fs4_rounds = []
    empty = set()
    for _ in range(n):
        stops = [rng.randrange(lens[r]) for r in range(REELS)]
        hot = rng.randrange(HOT_CHANCE) == 0
        win, sc, _ = eval_spin(stops, hot, empty, pays, scatter_pay)
        session = win
        if hot: hot_total += win
        else: base_total += win
        # free spins (tiered: 3sc = per-spin expansion, 4+sc = STICKY cap-N)
        if sc >= 3:
            sticky_round = sc >= 4
            sticky = set()
            round_win = 0
            fs_left, fs_played = FS_COUNT, 0
            while fs_left > 0 and fs_played < FS_CAP:
                fs_left -= 1; fs_played += 1
                st = [rng.randrange(lens[r]) for r in range(REELS)]
                if sticky_round:
                    # First STICKY_CAP wild-landing reels become permanent
                    # towers (leftmost first); later wilds stay 1:1 wilds.
                    for i in range(REELS):
                        if len(sticky) >= STICKY_CAP: break
                        if i not in sticky and PRE[i][st[i]][1] > 0:
                            sticky.add(i)
                    w2, sc2, _ = eval_spin(st, False, sticky, pays, scatter_pay)
                else:
                    w2, sc2, _ = eval_spin(st, True, sticky, pays, scatter_pay)
                round_win += w2
                session += w2
                # Retrigger re-awards the full freeSpinsCount (contract/mock
                # parity), bounded by the tight total cap.
                if sc2 >= 3 and fs_played < FS_CAP:
                    fs_left = min(fs_left + FS_COUNT, FS_CAP - fs_played)
            if sticky_round:
                fs4_total += round_win; fs4_rounds.append(round_win)
            else:
                fs3_total += round_win; fs3_rounds.append(round_win)
        if session > MAX_WIN_X * 10000:
            session = MAX_WIN_X * 10000
        total += session
        if session > 0: hits += 1
    rtp = total / (n * 10000)
    fs3_rounds.sort(); fs4_rounds.sort()
    X = 10000
    return {
        'rtp_pct': rtp * 100,
        'hit_freq_pct': hits / n * 100,
        'fs3_trigger_1_in': n / max(1, len(fs3_rounds)),
        'fs4_trigger_1_in': n / max(1, len(fs4_rounds)),
        'avg_fs3_round_x': sum(fs3_rounds) / max(1, len(fs3_rounds)) / X,
        'avg_fs4_round_x': sum(fs4_rounds) / max(1, len(fs4_rounds)) / X,
        'fs3_dist_x': {'p50': pct(fs3_rounds, 0.50) / X, 'p90': pct(fs3_rounds, 0.90) / X,
                       'p99': pct(fs3_rounds, 0.99) / X, 'max': (fs3_rounds[-1] / X) if fs3_rounds else 0},
        'fs4_dist_x': {'p50': pct(fs4_rounds, 0.50) / X, 'p90': pct(fs4_rounds, 0.90) / X,
                       'p99': pct(fs4_rounds, 0.99) / X, 'max': (fs4_rounds[-1] / X) if fs4_rounds else 0},
        'fs4_ge_800x_pct': 100 * sum(1 for w in fs4_rounds if w >= 800 * X) / max(1, len(fs4_rounds)),
        'fs4_ge_maxwin_pct': 100 * sum(1 for w in fs4_rounds if w >= MAX_WIN_X * X) / max(1, len(fs4_rounds)),
        'base_pct': base_total / (n * X) * 100,
        'hot_pct': hot_total / (n * X) * 100,
        'fs3_pct': fs3_total / (n * X) * 100,
        'fs4_pct': fs4_total / (n * X) * 100,
    }

if __name__ == '__main__':
    n_tune = int(sys.argv[1]) if len(sys.argv) > 1 else 400_000
    if os.environ.get('VH_K'):
        # Refinement pass: skip tuning, use the externally fitted k.
        k = float(os.environ['VH_K'])
        print(f'fixed k = {k:.4f} (VH_K)')
    else:
        r1 = simulate(n_tune, BASE_PAYS, SCATTER_PAY, seed=7)
        print('TUNING RUN (k=1):', json.dumps(r1, indent=1))
        k = 96.0 / r1['rtp_pct']
        print(f'scale k = {k:.4f}')
    pays = {s: [max(1, round(v * k)) for v in p] for s, p in BASE_PAYS.items()}
    scat = [max(1, round(v * k)) for v in SCATTER_PAY]
    n_final = int(sys.argv[2]) if len(sys.argv) > 2 else 4_000_000
    r2 = simulate(n_final, pays, scat, seed=99)
    print('CERTIFICATION RUN:', json.dumps(r2, indent=1))
    r3 = simulate(min(n_final, 1_000_000), pays, scat, seed=1234)
    print('ALT-SEED SANITY:', json.dumps({'rtp_pct': r3['rtp_pct']}, indent=1))
    out = {
        'gridId': f'5x{ROWS}',
        'targetRtpPct': 96.0,
        'rtpBps': round(r2['rtp_pct'] * 100),
        'reelStrips': STRIPS,
        'reelLength': 40,
        'payTable': {
            'wild': pays[2], 'highA': pays[2], 'highB': pays[3],
            'midC': pays[4], 'midD': pays[5],
            'lowE': pays[6], 'lowF': pays[7], 'lowG': pays[8],
        },
        'scatterPay': scat,
        'freeSpinsCount': FS_COUNT, 'freeSpinsCap': FS_CAP, 'freeSpinMultiplier': 1,
        'maxWinMultiplier': MAX_WIN_X, 'minWager': 10000,
        'custom': {
            'expandingWildsInFreeSpins': True,
            'stickyExpandingFrom4Scatters': True,
            'stickyTowerCap': STICKY_CAP,
            'hotSpinChance1In': HOT_CHANCE,
            'hotSpinExpandsWilds': True,
            'notes': 'Wild expands to full reel BEFORE ways evaluation in FS and hot spins. '
                     'A 4+-scatter trigger plays STICKY expansion: expanded reels stay fully '
                     'wild for the rest of the round. Fully wild reels contribute no scatters. '
                     'Reel 1 carries no wilds (no wild-line double count). Wild pays as highA.',
        },
        'simResults': r2,
    }
    with open('custom-math/vice_heat_expanding.json', 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=1)
    print('manifest written -> custom-math/vice_heat_expanding.json')
