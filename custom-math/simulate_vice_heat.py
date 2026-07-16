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
    # ANTI-CLUSTERED lows: C/E/G run heavy on reels 1/3/5 and thin on 2/4,
    # B/D/F the other way around — 3-in-a-row chains break at the thin reel,
    # so the hit rate HALVES (~50% instead of 83%) while the hits that do
    # land carry multiple ways on the heavy reels. Fewer, MEANINGFUL wins:
    # that's what funds the >=0.10x-per-connection pay floor.
    STRIPS = [
        build_strip({SC: 1, 2: 4, 3: 2, 4: 8, 5: 2, 6: 10, 7: 2, 8: 11}),        # R1: no wild
        build_strip({W: 1, SC: 1, 2: 4, 3: 7, 4: 2, 5: 8, 6: 2, 7: 13, 8: 2}),   # R2
        build_strip({W: 1, SC: 1, 2: 4, 3: 2, 4: 8, 5: 2, 6: 10, 7: 2, 8: 10}),  # R3
        build_strip({W: 1, SC: 1, 2: 4, 3: 7, 4: 2, 5: 8, 6: 2, 7: 13, 8: 2}),   # R4
        build_strip({W: 1, SC: 1, 2: 4, 3: 2, 4: 8, 5: 2, 6: 10, 7: 2, 8: 10}),  # R5
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
# HARD PAY FLOOR: the smallest possible connection (single-way 3-oak lowG)
# pays >= 1000 bps = 0.10x bet — $0.02 on a $0.20 spin, always visible at
# 2 decimals. Noski: "selbst auf 20 Cent würde ich safe 0.02 kriegen
# minimum". The per-way curve is deliberately FLAT-ish — with 3125 ways the
# TOP comes from ways mass x expansion x simul-mult (a full-tower spin
# multiplies 625-3125 ways into the 5-oak row), not from per-way steepness.
BASE_PAYS = {
    2: [1100, 1800, 3200],
    3: [1060, 1600, 2600],
    4: [1030, 1400, 2100],
    5: [1030, 1300, 1900],
    6: [1030, 1200, 1600],
    7: [1030, 1150, 1450],
    8: [1030, 1100, 1300],
}
# Scatter pay floored too (it shows in the tally like any connection).
SCATTER_PAY = [1030, 2000, 6000]   # 3/4/5 scatters, x total bet bps
# Retrigger awards a SMALL fixed amount (custom contract rule
# `retriggerSpins`, NOT the template's re-award-freeSpinsCount), and the
# TIGHT total cap allows at most ONE retrigger: max win must come from the
# SETUP (early towers), never from grinding endless retriggered spins.
FS_COUNT = int(os.environ.get('VH_FS_SPINS', '7' if ROWS == 5 else '10'))
FS_RETRIG = 3
FS_CAP = int(os.environ.get('VH_FS_CAP', '10'))
# Sticky rounds (4+ scatters) run LONGER — the towers need spins to
# accumulate; their own count/cap (custom rules stickyRoundSpins/-Cap).
# 10 spins (Noski: "5 ist zu wenig") + one +3 retrigger of headroom (cap 13).
FS_COUNT_STICKY = int(os.environ.get('VH_STICKY_SPINS', '10'))
FS_CAP_STICKY = int(os.environ.get('VH_STICKY_ROUND_CAP', '13'))
HOT_CHANCE = 80                   # 1-in-80 base spins are HOT (expansion mode)
MAX_WIN_X = 5000
# Sticky rounds: the first N wild-landing reels become permanent towers
# (leftmost joins first on ties). Cap 3 (was 4): at the LONGER 10-spin round a
# full 4-tower board would form almost every time and pay x-huge every spin —
# that made RTP blow past 100%. Cap 3 keeps the sticky round premium (avg
# ~280x, the reliable-big tier) without turning it into a guaranteed max win.
STICKY_CAP = int(os.environ.get('VH_STICKY_CAP', '3'))
# FULL-BOARD BONUS (sticky rounds only): while ALL towers stand, every spin
# pays xN. Set to 1 (OFF): the x2 "full house" doubling compounded over 10
# sticky spins is what pushed RTP to 105%+. With it off the 4-scatter route is
# the high-AVERAGE tier; the 5000x MAX WIN comes from the 3-scatter simul spike.
STICKY_FULL_MULT = int(os.environ.get('VH_STICKY_FULL_MULT', '1'))
# SIMULTANEOUS-EXPANSION MULTIPLIERS (per-spin expansion contexts only: the
# 3-scatter bonus + hot spins; NEVER sticky rounds): n reels expanding in the
# SAME spin multiply that spin's win per this table. The 4-reel-alignment x10
# with a premium reel-1 window IS the game's MAX WIN pattern — the only route
# that reaches the 5000x cap now that the 4-scatter full house is retired.
SIMUL_MULTS = {3: int(os.environ.get('VH_SIMUL3', '2')), 4: int(os.environ.get('VH_SIMUL4', '10'))}

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
    total_sq = 0.0  # per-session x-of-bet squared, for the RTP confidence interval
    hits = 0
    base_total = 0; fs3_total = 0; fs4_total = 0; hot_total = 0
    fs3_rounds = []; fs4_rounds = []
    empty = set()
    for _ in range(n):
        stops = [rng.randrange(lens[r]) for r in range(REELS)]
        hot = rng.randrange(HOT_CHANCE) == 0
        win, sc, full = eval_spin(stops, hot, empty, pays, scatter_pay)
        if hot:
            win *= SIMUL_MULTS.get(len(full), 1)
        session = win
        if hot: hot_total += win
        else: base_total += win
        # free spins (tiered: 3sc = per-spin expansion, 4+sc = STICKY cap-N)
        if sc >= 3:
            sticky_round = sc >= 4
            sticky = set()
            round_win = 0
            fs_left = FS_COUNT_STICKY if sticky_round else FS_COUNT
            cap = FS_CAP_STICKY if sticky_round else FS_CAP
            fs_played = 0
            while fs_left > 0 and fs_played < cap:
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
                    # FULL HOUSE: all towers standing -> the spin pays xN.
                    if len(sticky) >= STICKY_CAP:
                        w2 *= STICKY_FULL_MULT
                else:
                    w2, sc2, full = eval_spin(st, True, sticky, pays, scatter_pay)
                    w2 *= SIMUL_MULTS.get(len(full), 1)
                round_win += w2
                session += w2
                # HARD SESSION CAP: the round STOPS the moment the cap is
                # reached — no further spins, payout locked at MAX_WIN_X.
                if session >= MAX_WIN_X * 10000:
                    break
                # Retrigger awards retriggerSpins (custom rule), bounded by
                # the tight per-tier cap (at most one retrigger fits).
                if sc2 >= 3 and fs_played < cap:
                    fs_left = min(fs_left + FS_RETRIG, cap - fs_played)
            if sticky_round:
                fs4_total += round_win; fs4_rounds.append(round_win)
            else:
                fs3_total += round_win; fs3_rounds.append(round_win)
        if session > MAX_WIN_X * 10000:
            session = MAX_WIN_X * 10000
        total += session
        total_sq += (session / 10000.0) ** 2
        if session > 0: hits += 1
    rtp = total / (n * 10000)
    # 99% CI half-width for the RTP estimate (CLT on per-session results).
    mean_x = rtp
    var_x = max(0.0, total_sq / n - mean_x * mean_x)
    ci99_pp = 2.576 * (var_x ** 0.5) / (n ** 0.5) * 100
    std_x = var_x ** 0.5
    fs3_rounds.sort(); fs4_rounds.sort()
    X = 10000
    return {
        'rtp_pct': rtp * 100,
        'rtp_ci99_pp': ci99_pp,
        'per_spin_std_x': std_x,
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
        'fs3_ge_800x_pct': 100 * sum(1 for w in fs3_rounds if w >= 800 * X) / max(1, len(fs3_rounds)),
        'fs3_ge_maxwin_pct': 100 * sum(1 for w in fs3_rounds if w >= MAX_WIN_X * X) / max(1, len(fs3_rounds)),
        'base_pct': base_total / (n * X) * 100,
        'hot_pct': hot_total / (n * X) * 100,
        'fs3_pct': fs3_total / (n * X) * 100,
        'fs4_pct': fs4_total / (n * X) * 100,
    }

if __name__ == '__main__':
    # Fit target: the longer 10-spin sticky round barely clips the 5000x cap
    # (only the rare 3-scatter spike does), so realized RTP now lands close to
    # the fit target — targeting ~93.5% keeps the house economics of the
    # original certification while the 7/10-spin rounds run longer.
    TARGET_RTP = float(os.environ.get('VH_TARGET_RTP', '93.5'))
    n_tune = int(sys.argv[1]) if len(sys.argv) > 1 else 400_000
    if os.environ.get('VH_K'):
        # Refinement pass: skip tuning, use the externally fitted k.
        k = float(os.environ['VH_K'])
        print(f'fixed k = {k:.4f} (VH_K)')
    else:
        r1 = simulate(n_tune, BASE_PAYS, SCATTER_PAY, seed=7)
        print('TUNING RUN (k=1):', json.dumps(r1, indent=1))
        k = TARGET_RTP / r1['rtp_pct']
        print(f'scale k = {k:.4f}')
    pays = {s: [max(1, round(v * k)) for v in p] for s, p in BASE_PAYS.items()}
    scat = [max(1, round(v * k)) for v in SCATTER_PAY]
    n_final = int(sys.argv[2]) if len(sys.argv) > 2 else 4_000_000
    cert_seed = int(os.environ.get('VH_CERT_SEED', '99'))
    r2 = simulate(n_final, pays, scat, seed=cert_seed)
    print('CERTIFICATION RUN:', json.dumps(r2, indent=1))
    r3 = simulate(min(n_final, 1_000_000), pays, scat, seed=1234)
    print('ALT-SEED SANITY:', json.dumps({'rtp_pct': r3['rtp_pct']}, indent=1))
    out = {
        'gridId': f'5x{ROWS}',
        'targetRtpPct': TARGET_RTP,
        'rtpBps': round(r2['rtp_pct'] * 100),
        'reelStrips': STRIPS,
        'reelLength': 40,
        'payTable': {
            'wild': pays[2], 'highA': pays[2], 'highB': pays[3],
            'midC': pays[4], 'midD': pays[5],
            'lowE': pays[6], 'lowF': pays[7], 'lowG': pays[8],
        },
        'scatterPay': scat,
        'freeSpinsCount': FS_COUNT, 'freeSpinsCap': FS_CAP, 'retriggerSpins': FS_RETRIG,
        'freeSpinMultiplier': 1,
        'maxWinMultiplier': MAX_WIN_X, 'minWager': 10000,
        'custom': {
            'expandingWildsInFreeSpins': True,
            'stickyExpandingFrom4Scatters': True,
            'stickyTowerCap': STICKY_CAP,
            'retriggerSpins': FS_RETRIG,
            'stickyRoundSpins': FS_COUNT_STICKY,
            'stickyRoundCap': FS_CAP_STICKY,
            'simulExpandMultipliers': {str(k): v for k, v in SIMUL_MULTS.items()},
            'stickyFullBoardMultiplier': STICKY_FULL_MULT,
            'hotSpinChance1In': HOT_CHANCE,
            'hotSpinExpandsWilds': True,
            'notes': 'Wild expands to full reel BEFORE ways evaluation in FS and hot spins. '
                     'A 4+-scatter trigger plays STICKY expansion: expanded reels stay fully '
                     'wild for the rest of the round. While ALL stickyTowerCap towers stand, '
                     'every sticky spin pays x stickyFullBoardMultiplier (FULL HOUSE — the '
                     '4-scatter max-win engine). Fully wild reels contribute no scatters. '
                     'Reel 1 carries no wilds (no wild-line double count). Wild pays as highA.',
        },
        'simResults': r2,
    }
    with open('custom-math/vice_heat_expanding.json', 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=1)
    print('manifest written -> custom-math/vice_heat_expanding.json')
