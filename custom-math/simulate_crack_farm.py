# Crack Farm — custom math model simulator (PAYLINES, 5x3)
#
# The slot plays 10 classic paylines (NOT ways): leftmost-consecutive,
# wilds substitute, payBps = bps of TOTAL bet per winning line.
#
# TIERED FREE-SPINS BONUS:
#   3 scatters -> ROAMING PLANT: every FS spin exactly ONE wild-capable reel
#                 sprouts fully wild for that spin (guaranteed action).
#   4 scatters -> STICKY PLANTS: wild-landing reels become permanent plant
#                 towers; a shared MULTIPLIER starts at 1x and grows +1 per
#                 WINNING CONNECTION while >=1 tower stands; line wins that
#                 CROSS a tower pay x multiplier. This is the max-win engine.
# Hard session cap 5000x. Mirrors src/dev/mockHost.ts + src/game/paylineEval.ts.

import random, json, sys, os

REELS, ROWS = 5, 3
W, SC = 0, 1
SYMS = [2, 3, 4, 5, 6, 7, 8]

# Strips: reuse the proven vol3 5x3 strips (from src/data/math_vol3_5x3.json).
HERE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(HERE, '..', 'src', 'data', 'math_vol3_5x3.json'), encoding='utf-8') as f:
    VOL3 = json.load(f)
STRIPS = VOL3['reelStrips']
LENS = [len(s) for s in STRIPS]
WILD_CAPABLE = [i for i, s in enumerate(STRIPS) if W in s]

PAYLINES = [
    [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2],
    [0, 1, 2, 1, 0], [2, 1, 0, 1, 2], [0, 0, 1, 2, 2],
    [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1],
    [0, 1, 1, 1, 2],
]

# Relative line paytable (bps of TOTAL bet per line, [3,4,5]); k-fitted below.
BASE_PAYS = {
    2: [8000, 30000, 200000],
    3: [6000, 20000, 100000],
    4: [4000, 12000, 50000],
    5: [3000, 10000, 40000],
    6: [2000, 6000, 20000],
    7: [1500, 5000, 15000],
    8: [1000, 4000, 10000],
}
SCATTER_PAY = [10000, 30000, 100000]
FS_COUNT = int(os.environ.get('CF_FS_SPINS', '8'))       # 3sc round
FS_STICKY = int(os.environ.get('CF_STICKY_SPINS', '8'))  # 4sc round
FS_CAP = int(os.environ.get('CF_FS_CAP', '11'))
FS_RETRIG = 3
STICKY_CAP = int(os.environ.get('CF_STICKY_CAP', '3'))
MULTI_INC = int(os.environ.get('CF_MULTI_INC', '1'))
# 'crossing' = only tower-crossing connections grow the multi (tamer);
# 'all' = every winning connection grows it while a tower stands.
MULTI_MODE = os.environ.get('CF_MULTI_MODE', 'crossing')
MULTI_CAP = int(os.environ.get('CF_MULTI_CAP', '20'))
MAX_WIN_X = 5000
TARGET_RTP = float(os.environ.get('CF_TARGET_RTP', '94.0'))


def window(reel, stop):
    s = STRIPS[reel]
    return [s[(stop + r) % LENS[reel]] for r in range(ROWS)]


def eval_lines(board, pays, scat, towers=None):
    """board[row][reel]. Returns (win_bps, scatters, line_wins) where
    line_wins = list of crosses_tower booleans (one per winning line)."""
    scatters = sum(1 for row in board for c in row if c == SC)
    win = 0
    line_wins = []
    if scatters >= 3:
        win += scat[min(scatters, 5) - 3]
    def score_run(line, eff):
        if eff not in pays:
            return None
        n = 0
        crosses = False
        for reel in range(REELS):
            sym = board[line[reel]][reel]
            if sym == eff or sym == W:
                n += 1
                if towers and reel in towers:
                    crosses = True
            else:
                break
        if n < 3:
            return None
        return (pays[eff][n - 3], crosses)

    for line in PAYLINES:
        # Classic-slots rule (mirrors src/game/paylineEval.ts): score BOTH the
        # substitute interpretation (first non-wild) and the wild-lead run
        # (wild pays as highA); the line pays only its HIGHER interpretation.
        eff = None
        saw_wild = False
        for reel in range(REELS):
            sym = board[line[reel]][reel]
            if sym == SC:
                break
            if sym != W:
                eff = sym
                break
            saw_wild = True
        cands = []
        if eff is not None:
            c = score_run(line, eff)
            if c: cands.append(c)
        if saw_wild:
            c = score_run(line, 2)
            if c: cands.append(c)
        if not cands:
            continue
        best = max(cands, key=lambda c: c[0])
        line_wins.append(best)
        win += best[0]
    return win, scatters, line_wins


def simulate(n, pays, scat, seed=42):
    rng = random.Random(seed)
    total = 0
    total_sq = 0.0
    hits = 0
    base_total = 0; fs3_total = 0; fs4_total = 0
    fs3_rounds = []; fs4_rounds = []
    for _ in range(n):
        stops = [rng.randrange(LENS[r]) for r in range(REELS)]
        board = [[window(r, stops[r])[row] for r in range(REELS)] for row in range(ROWS)]
        win, sc_n, _ = eval_lines(board, pays, scat)
        session = win
        base_total += win
        if sc_n >= 3:
            sticky_round = sc_n >= 4
            towers = set()
            multi = 1
            round_win = 0
            fs_left = FS_STICKY if sticky_round else FS_COUNT
            played = 0
            while fs_left > 0 and played < FS_CAP:
                fs_left -= 1; played += 1
                st = [rng.randrange(LENS[r]) for r in range(REELS)]
                b = [[window(r, st[r])[row] for r in range(REELS)] for row in range(ROWS)]
                if sticky_round:
                    for reel in range(REELS):
                        if len(towers) >= STICKY_CAP: break
                        if reel not in towers and any(b[row][reel] == W for row in range(ROWS)):
                            towers.add(reel)
                    for reel in towers:
                        for row in range(ROWS): b[row][reel] = W
                    w2_base, sc2, line_wins = eval_lines(b, pays, scat, towers)
                    # scatter part + tower-crossing lines x multi
                    scat_part = w2_base - sum(lw for lw, _ in line_wins)
                    w2 = scat_part
                    for lw, crosses in line_wins:
                        w2 += lw * multi if crosses else lw
                    if towers:
                        grow = (sum(1 for _, c in line_wins if c)
                                if MULTI_MODE == 'crossing' else len(line_wins))
                        multi = min(MULTI_CAP, multi + grow * MULTI_INC)
                else:
                    roam = WILD_CAPABLE[rng.randrange(len(WILD_CAPABLE))]
                    for row in range(ROWS): b[row][roam] = W
                    w2, sc2, _ = eval_lines(b, pays, scat)
                round_win += w2
                session += w2
                if session >= MAX_WIN_X * 10000:
                    break
                if sc2 >= 3 and played < FS_CAP:
                    fs_left = min(fs_left + FS_RETRIG, FS_CAP - played)
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
    var_x = max(0.0, total_sq / n - rtp * rtp)
    fs3_rounds.sort(); fs4_rounds.sort()
    X = 10000
    def pct(a, q):
        return a[min(len(a) - 1, int(q * len(a)))] / X if a else 0.0
    return {
        'rtp_pct': rtp * 100,
        'rtp_ci99_pp': 2.576 * (var_x ** 0.5) / (n ** 0.5) * 100,
        'hit_freq_pct': hits / n * 100,
        'fs3_trigger_1_in': n / max(1, len(fs3_rounds)),
        'fs4_trigger_1_in': n / max(1, len(fs4_rounds)),
        'avg_fs3_round_x': sum(fs3_rounds) / max(1, len(fs3_rounds)) / X,
        'avg_fs4_round_x': sum(fs4_rounds) / max(1, len(fs4_rounds)) / X,
        'fs3_max_x': (fs3_rounds[-1] / X) if fs3_rounds else 0,
        'fs4_max_x': (fs4_rounds[-1] / X) if fs4_rounds else 0,
        'fs3_ge_maxwin_pct': 100 * sum(1 for w in fs3_rounds if w >= MAX_WIN_X * X) / max(1, len(fs3_rounds)),
        'fs4_ge_maxwin_pct': 100 * sum(1 for w in fs4_rounds if w >= MAX_WIN_X * X) / max(1, len(fs4_rounds)),
        'base_pct': base_total / (n * X) * 100,
        'fs3_pct': fs3_total / (n * X) * 100,
        'fs4_pct': fs4_total / (n * X) * 100,
    }


if __name__ == '__main__':
    n_tune = int(sys.argv[1]) if len(sys.argv) > 1 else 400_000
    n_final = int(sys.argv[2]) if len(sys.argv) > 2 else 4_000_000
    if os.environ.get('CF_K'):
        k = float(os.environ['CF_K'])
        print(f'fixed k = {k:.4f} (CF_K)')
    else:
        r1 = simulate(n_tune, BASE_PAYS, SCATTER_PAY, seed=7)
        print('TUNING RUN (k=1):', json.dumps(r1, indent=1))
        k = TARGET_RTP / r1['rtp_pct']
        print(f'scale k = {k:.4f}')
    pays = {s: [max(1, round(v * k)) for v in p] for s, p in BASE_PAYS.items()}
    scat = [max(1, round(v * k)) for v in SCATTER_PAY]
    r2 = simulate(n_final, pays, scat, seed=int(os.environ.get('CF_CERT_SEED', '99')))
    print('CERTIFICATION RUN:', json.dumps(r2, indent=1))
    r3 = simulate(min(n_final, 1_000_000), pays, scat, seed=1234)
    print('ALT-SEED SANITY:', json.dumps({'rtp_pct': r3['rtp_pct']}, indent=1))
    out = {
        'gridId': '5x3',
        'targetRtpPct': TARGET_RTP,
        'rtpBps': round(r2['rtp_pct'] * 100),
        'payModel': 'lines',
        'paylines': PAYLINES,
        'reelStrips': STRIPS,
        'reelLength': LENS[0],
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
            'paylines': 10,
            'roamingWildFrom3Scatters': True,
            'stickyPlantFrom4Scatters': True,
            'plantMultiIncrement': MULTI_INC,
            'plantMultiCap': MULTI_CAP,
            'plantMultiMode': MULTI_MODE,
            'stickyTowerCap': STICKY_CAP,
            'stickyRoundSpins': FS_STICKY,
            'stickyRoundCap': FS_CAP,
            'retriggerSpins': FS_RETRIG,
            'notes': 'PAYLINES model (10 lines, leftmost, wilds substitute; payBps = bps of '
                     'total bet per line). 3sc: every FS spin ONE seed-derived wild-capable reel '
                     'is fully wild (roaming plant). 4sc: wild-landing reels become permanent '
                     'plant towers; shared multi starts 1x, +plantMultiIncrement per winning '
                     'connection while a tower stands; tower-crossing line wins pay x multi. '
                     'Fully wild reels contribute no scatters. Hard 5000x session cap.',
        },
        'simResults': r2,
    }
    with open(os.path.join(HERE, 'crack_farm_lines.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=1)
    print('manifest written -> custom-math/crack_farm_lines.json')
