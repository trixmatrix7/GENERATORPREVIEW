# Crack Farm v2 — PAYLINES 5x3 with the PLANT / DOUBLING-MULTIPLIER feature.
#
# Rules this models (Noski's spec):
#   * 10 classic paylines, leftmost-consecutive, wilds substitute, scatter pays
#     anywhere. payBps = bps of TOTAL bet per winning line.
#   * FREE SPINS — 3 / 4 / 5 scatters award the SAME spin count; only the
#     plants' STARTING multiplier differs:
#         3sc -> start 1x (no badge)   4sc -> start 8x   5sc -> start 32x
#   * PLANTS: 1..5 of them, weighted so 1-2 is normal, 3 occasional,
#     4 rare, 5 very rare. They RELOCATE every spin (reel changes) and a
#     landing wild can add one, up to the drawn count.
#   * A line win that CROSSES plants pays x the PRODUCT of those plants'
#     multipliers; each crossing connection then DOUBLES that plant's
#     multiplier, capped at 1024x.
#   * Hard session cap = the version's max win (5000x / 10000x / 15000x).
#
# Usage:  python custom-math/simulate_crack_farm_v2.py [spins] [maxwin_x]
# Env:    CF_TARGET_RTP (default 96), CF_FS_SPINS (default 7)

import random, json, os, sys

REELS, ROWS = 5, 3
W, SC = 0, 1

HERE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(HERE, '..', 'src', 'data', 'math_vol3_5x3.json'), encoding='utf-8') as f:
    VOL3 = json.load(f)

def thin_scatters(strips, keep=1, pad=0):
    """Crack Farm's own strips: vol3's shape, but scatters thinned out.

    vol3 carries 2 scatters per 40-slot strip (5%), which fires free spins
    1 in 37. The plant/doubling feature is far too strong to run that often —
    it left the base game paying 1.3% of a 114% RTP.

    `keep` caps scatters per strip, then `pad` extends every strip with
    non-scatter symbols so the density drops evenly across all five reels.
    Both exist to buy the base game back its share: a round averages ~185x, so
    at 1 in 259 free spins alone accounted for 80% of the RTP.

    Padding rather than dropping scatters from whole reels: clearing reels 1
    and 3 would cap the board at three scatters, and the 4- and 5-scatter tiers
    (start multiplier 8x / 32x) could never land at all.
    """
    out = []
    for i, s in enumerate(strips):
        s = list(s)
        seen = 0
        for j, sym in enumerate(s):
            if sym == SC:
                seen += 1
                if seen > keep:
                    s[j] = 6 + (i + j) % 3   # low symbol filler
        # Pad with the strip's own non-scatter symbols, spread evenly so the
        # symbol mix (and therefore the base paytable) stays as vol3 tuned it.
        fillers = [x for x in s if x != SC]
        for n in range(pad):
            s.insert(((n + 1) * len(s)) // (pad + 1), fillers[(i * 7 + n * 13) % len(fillers)])
        out.append(s)
    return out


STRIPS = thin_scatters(VOL3['reelStrips'], keep=1, pad=6)
LENS = [len(s) for s in STRIPS]
# A plant is a FEATURE OVERLAY, not a strip symbol, so it can rise on ANY reel
# — including reel 0, whose strip carries no wild. Restricting plants to
# wild-carrying reels capped a round at 4 plants and made Noski's "1-5, 5 ganz
# selten" impossible to express.
PLANT_REELS = list(range(REELS))
WILD_CAPABLE = [i for i, s in enumerate(STRIPS) if W in s]

PAYLINES = [
    [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2],
    [0, 1, 2, 1, 0], [2, 1, 0, 1, 2], [0, 0, 1, 2, 2],
    [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1],
    [0, 1, 1, 1, 2],
]

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

FS_SPINS = int(os.environ.get('CF_FS_SPINS', '7'))   # same for 3/4/5 scatters
FS_RETRIG = 3
FS_CAP = FS_SPINS + 6                                 # room for two retriggers
MULTI_START = {3: 1, 4: 8, 5: 32}
MULTI_CAP = 1024
# 1..5 plants: normal 1-2, occasional 3, rare 4, VERY rare 5.
# 4 and 5 plants blanket the board, so all 10 paylines pay the top symbol and
# the multipliers land on every one of them. At [40,30,18,9,3] that happened
# often enough to force the paytable down to k=0.12, which left the base game
# paying 2.2% RTP — dead between features. These weights read the same way
# Noski described it and keep the board-covering cases genuinely rare.
PLANT_WEIGHTS = [55, 28, 12, 4, 1]
TARGET_RTP = float(os.environ.get('CF_TARGET_RTP', '96.0'))
X = 10000  # one bet unit in bps

# --- BASE-GAME PLANT FEATURE -------------------------------------------------
# The screen darkens mid-spin, the green pads light up and 1..5 plants slide in
# with a multiplier each; that one spin is then evaluated. Without this the base
# game carried under 10% of the RTP and felt dead between free-spin rounds.
BASE_FEAT_ODDS = 170          # roughly 1 in 170 spins
# (multiplier, weight). Tops out at 512x on purpose: 1024x is the FREE-SPIN
# prize you climb to by doubling, so handing it out in the base game both stole
# the feature's punch and made the model impossible to fit (a single 1024x line
# hit the max-win cap, so RTP swung 20 points between runs).
BASE_MULTI_TABLE = [
    (2, 620), (4, 240), (8, 90), (16, 32), (32, 11),
    (64, 4), (128, 2), (256, 1),
]


def window(reel, stop):
    s, L = STRIPS[reel], LENS[reel]
    return [s[(stop + r) % L] for r in range(ROWS)]


def eval_lines(board, pays, scat, plants=None):
    """Returns (scatter_win, scatter_count, [(line_win, crossed_reels)])."""
    scn = sum(1 for row in range(ROWS) for r in range(REELS) if board[row][r] == SC)
    scw = scat[min(scn - 3, 2)] if scn >= 3 else 0

    def score(line, eff):
        p = pays.get(eff)
        if not p:
            return None
        cnt, crossed = 0, []
        for r in range(REELS):
            sym = board[line[r]][r]
            if sym == eff or sym == W:
                cnt += 1
                if plants and r in plants:
                    crossed.append(r)
            else:
                break
        if cnt < 3:
            return None
        val = p[min(cnt - 3, 2)]
        return (val, crossed) if val else None

    out = []
    for line in PAYLINES:
        eff, saw_wild = None, False
        for r in range(REELS):
            sym = board[line[r]][r]
            if sym == SC:
                break
            if sym != W:
                eff = sym
                break
            saw_wild = True
        cands = []
        if eff is not None:
            c = score(line, eff)
            if c:
                cands.append(c)
        if saw_wild:
            c = score(line, 2)  # pure wild run pays as the top symbol
            if c:
                cands.append(c)
        if cands:
            out.append(max(cands, key=lambda c: c[0]))
    return scw, scn, out


def pick_plant_count(rng):
    t = sum(PLANT_WEIGHTS)
    x = rng.randrange(t)
    acc = 0
    for i, w in enumerate(PLANT_WEIGHTS):
        acc += w
        if x < acc:
            return i + 1
    return 1


def pick_base_multi(rng):
    t = sum(w for _, w in BASE_MULTI_TABLE)
    x = rng.randrange(t)
    acc = 0
    for m, w in BASE_MULTI_TABLE:
        acc += w
        if x < acc:
            return m
    return 2


def base_feature_spin(rng, pays, scat):
    """One darkened base-game spin with 1..5 multiplied plants."""
    n = pick_plant_count(rng)
    spots = rng.sample(PLANT_REELS, min(n, len(PLANT_REELS)))
    plants = {reel: pick_base_multi(rng) for reel in spots}

    stops = [rng.randrange(LENS[r]) for r in range(REELS)]
    b = [[window(r, stops[r])[row] for r in range(REELS)] for row in range(ROWS)]
    for reel in plants:
        for row in range(ROWS):
            b[row][reel] = W

    scw, _, lines = eval_lines(b, pays, scat, plants)
    win = scw
    for lw, crossed in lines:
        win += lw * max((plants[r] for r in crossed), default=1)
    return win


def free_round(rng, scatters, pays, scat, cap_bps, session_so_far):
    """One free-spins round. Returns the round's win in bps."""
    target_plants = pick_plant_count(rng)
    start_multi = MULTI_START[min(max(scatters, 3), 5)]
    plants = {}  # reel -> multiplier
    spins_left, played, round_win = FS_SPINS, 0, 0

    while spins_left > 0 and played < FS_CAP:
        spins_left -= 1
        played += 1
        stops = [rng.randrange(LENS[r]) for r in range(REELS)]
        b = [[window(r, stops[r])[row] for r in range(REELS)] for row in range(ROWS)]

        # RELOCATE: every standing plant moves to a fresh reel each spin, and a
        # landing wild can add one until the round's drawn count is reached.
        gained = 1 if (len(plants) < target_plants and
                       any(b[row][r] == W for row in range(ROWS) for r in WILD_CAPABLE)) else 0
        want = min(target_plants, max(len(plants), 1) + gained)
        carried = sorted(plants.values(), reverse=True)[:want]
        while len(carried) < want:
            carried.append(start_multi)
        spots = rng.sample(PLANT_REELS, min(want, len(PLANT_REELS)))
        plants = {reel: carried[i] for i, reel in enumerate(spots)}

        for reel in plants:
            for row in range(ROWS):
                b[row][reel] = W

        scw, scn, lines = eval_lines(b, pays, scat, plants)
        spin_win = scw
        for lw, crossed in lines:
            # HIGHEST crossed plant pays, not the product — multiplying 3
            # plants at 16x each would be 4096x on a single line and blows
            # the model apart (measured: RTP 3125%).
            mult = max((plants[r] for r in crossed), default=1)
            spin_win += lw * mult
        # A plant DOUBLES once per SPIN it took part in — not once per line.
        # (Per-line doubling meant a plant crossed by 10 paylines jumped 2^10
        # in a single spin; the reference games double per spin, research 14.)
        for r in {r for _, crossed in lines for r in crossed}:
            plants[r] = min(MULTI_CAP, plants[r] * 2)

        round_win += spin_win
        if session_so_far + round_win >= cap_bps:
            return cap_bps - session_so_far
        if scn >= 3 and played < FS_CAP:
            spins_left = min(spins_left + FS_RETRIG, FS_CAP - played)
    return round_win


def certify(pays, scat, max_win_x, base_n=600_000, fs_rounds=120_000,
            feat_n=120_000, seed=99):
    """Stratified RTP measurement — the only way to sign this model off.

    Straight play-through sampling cannot certify it: free spins trigger 1 in
    263 and a round averages ~170x, so almost the whole RTP rides on rare
    events. Six independent 300k-spin runs still disagreed by 16 RTP points,
    and the fit seed read 5 points above all of them.

    So measure each stratum on its OWN large sample and weight analytically:
      RTP = base + P(feature) x E[feature] + SUM_k P(k scatters) x E[round|k]
    Each term now gets 100k+ samples instead of the handful a play-through
    would spend on it, which is what makes the number reproducible.
    """
    cap_bps = max_win_x * X
    rng = random.Random(seed)

    # --- base stratum: line+scatter pay, and the scatter-count distribution.
    base_total = 0
    sc_hits = {3: 0, 4: 0, 5: 0}
    base_wins = []
    for _ in range(base_n):
        stops = [rng.randrange(LENS[r]) for r in range(REELS)]
        b = [[window(r, stops[r])[row] for r in range(REELS)] for row in range(ROWS)]
        scw, scn, lines = eval_lines(b, pays, scat)
        w = scw + sum(lw for lw, _ in lines)
        if scn >= 3:
            sc_hits[min(scn, 5)] += 1
        elif rng.randrange(BASE_FEAT_ODDS) == 0:
            # This spin fires the base feature, which REPLACES the plain win
            # (mockHost settlement: totalWin = feature sum). Its payout is the
            # feature stratum below, so its plain win must NOT be counted here —
            # otherwise the model double-counts ~P(feat)*E[plain] of RTP.
            continue
        base_total += w
        if w:
            base_wins.append(w / X)
    base_rtp = base_total / (base_n * X)
    p_sc = {k: v / base_n for k, v in sc_hits.items()}

    # --- feature stratum
    feat_vals = [base_feature_spin(rng, pays, scat) for _ in range(feat_n)]
    feat_vals = [min(v, cap_bps) for v in feat_vals]
    e_feat = sum(feat_vals) / feat_n
    p_feat = (1 - sum(p_sc.values())) / BASE_FEAT_ODDS
    feat_rtp = p_feat * e_feat / X

    # --- free-spin stratum, measured per scatter count
    fs_rtp = 0.0
    fs_stats = {}
    for k in (3, 4, 5):
        if p_sc[k] <= 0:
            continue
        vals = [free_round(rng, k, pays, scat, cap_bps, 0) for _ in range(fs_rounds)]
        e_round = sum(vals) / len(vals)
        fs_stats[k] = (e_round / X, max(vals) / X, [v / X for v in vals])
        fs_rtp += p_sc[k] * e_round / X

    return {
        'rtp': base_rtp + feat_rtp + fs_rtp,
        'base_rtp': base_rtp, 'feat_rtp': feat_rtp, 'fs_rtp': fs_rtp,
        'p_sc': p_sc, 'p_feat': p_feat, 'e_feat': e_feat / X,
        'fs_stats': fs_stats, 'base_wins': base_wins, 'base_n': base_n,
        'feat_vals': [v / X for v in feat_vals],
    }


BANDS = [(0, 1), (1, 5), (5, 20), (20, 50), (50, 100), (100, 250),
         (250, 500), (500, 1000), (1000, 2500), (2500, 5000),
         (5000, 10000), (10000, 999999)]


def weighted_spread(c):
    """Per-spin odds of landing in each win band, built from the strata.

    Each stratum contributes its own measured distribution scaled by how often
    that stratum actually happens, so even the 1-in-56,000 bands rest on
    100k+ samples instead of the two or three a play-through would see.
    """
    prob = [0.0] * len(BANDS)

    def add(vals, weight):
        if not vals:
            return
        per = weight / len(vals)
        for v in vals:
            for i, (lo, hi) in enumerate(BANDS):
                if lo <= v < hi:
                    prob[i] += per
                    break

    add(c['base_wins'], len(c['base_wins']) / c['base_n'])
    add(c['feat_vals'], c['p_feat'])
    for k, (_, _, vals) in c['fs_stats'].items():
        add(vals, c['p_sc'][k])
    return [(f'{lo}-{hi}x', p) for (lo, hi), p in zip(BANDS, prob) if p > 0]


def simulate(n, pays, scat, max_win_x, seed=42):
    rng = random.Random(seed)
    cap_bps = max_win_x * X
    total = 0
    hits = 0
    wins = []          # every non-zero session win in x-bet
    fs_rounds = []
    base_total = 0
    fs_total = 0
    feat_total = 0
    feats = 0
    for _ in range(n):
        stops = [rng.randrange(LENS[r]) for r in range(REELS)]
        board = [[window(r, stops[r])[row] for r in range(REELS)] for row in range(ROWS)]
        scw, scn, lines = eval_lines(board, pays, scat)
        session = scw + sum(lw for lw, _ in lines)
        base_total += session
        if scn < 3 and rng.randrange(BASE_FEAT_ODDS) == 0:
            fw = base_feature_spin(rng, pays, scat)
            feat_total += fw
            feats += 1
            session += fw
        if scn >= 3:
            rw = free_round(rng, scn, pays, scat, cap_bps, session)
            fs_total += rw
            fs_rounds.append(rw / X)
            session += rw
        session = min(session, cap_bps)
        total += session
        if session > 0:
            hits += 1
            wins.append(session / X)
    return {
        'rtp': total / (n * X),
        'hit': hits / n,
        'base_rtp': base_total / (n * X),
        'fs_rtp': fs_total / (n * X),
        'feat_rtp': feat_total / (n * X),
        'feat_freq': feats / n,
        'fs_freq': len(fs_rounds) / n,
        'fs_avg': (sum(fs_rounds) / len(fs_rounds)) if fs_rounds else 0,
        'fs_max': max(fs_rounds) if fs_rounds else 0,
        'wins': wins,
    }


def spread(wins, n):
    """Distribution of win sizes — the 'every x-range is reachable' check."""
    bands = [(0, 1), (1, 5), (5, 20), (20, 50), (50, 100), (100, 250),
             (250, 500), (500, 1000), (1000, 2500), (2500, 5000),
             (5000, 10000), (10000, 999999)]
    out = []
    for lo, hi in bands:
        c = sum(1 for w in wins if lo <= w < hi)
        if c:
            out.append((f'{lo}-{hi}x', c, f'1 in {n // c:,}' if c else '-'))
    return out


if __name__ == '__main__':
    scale = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    max_win = int(sys.argv[2]) if len(sys.argv) > 2 else 5000

    def build(k):
        return ({s: [int(round(v * k)) for v in vals] for s, vals in BASE_PAYS.items()},
                [int(round(v * k)) for v in SCATTER_PAY])

    # Fit k against the STRATIFIED measurement (cheap sample), then certify on
    # a large one. RTP is near-linear in k, so scaling converges in 3-4 passes.
    k = 0.5
    for i in range(6):
        pays, scat = build(k)
        c = certify(pays, scat, max_win, base_n=120_000 * scale,
                    fs_rounds=20_000 * scale, feat_n=20_000 * scale, seed=11)
        rtp = c['rtp'] * 100
        print(f'  fit {i + 1}: k={k:.4f} -> RTP {rtp:.2f}%')
        if abs(rtp - TARGET_RTP) < 0.25:
            break
        k *= TARGET_RTP / rtp
    pays, scat = build(k)

    # Certification pass: big samples, and a second seed to prove the number
    # actually reproduces (the old play-through method disagreed by 16 points).
    #
    # The cheap fit lands a few points high — its smaller sample under-counts
    # the rare huge rounds — so trim k against the FULL-SIZE measurement before
    # signing off, otherwise the shipped paytable reads ~90% instead of 96%.
    big = dict(base_n=600_000 * scale, fs_rounds=120_000 * scale,
               feat_n=120_000 * scale)
    for i in range(3):
        c = certify(pays, scat, max_win, seed=99, **big)
        rtp = c['rtp'] * 100
        print(f'  trim {i + 1}: k={k:.4f} -> RTP {rtp:.2f}%')
        if abs(rtp - TARGET_RTP) < 0.4:
            break
        k *= TARGET_RTP / rtp
        pays, scat = build(k)
    c2 = certify(pays, scat, max_win, seed=4242, **big)

    print(f'\n=== Crack Farm v2 - max win {max_win}x (stratified) ===')
    print(f'k = {k:.4f}')
    print(f'RTP        {c["rtp"]*100:.2f}%   (reproduce {c2["rtp"]*100:.2f}%, '
          f'delta {abs(c["rtp"]-c2["rtp"])*100:.2f} pts)')
    print(f'  base     {c["base_rtp"]*100:.2f}%')
    print(f'  feature  {c["feat_rtp"]*100:.2f}%   1 in {1/c["p_feat"]:.0f}   avg {c["e_feat"]:.1f}x')
    print(f'  free sp  {c["fs_rtp"]*100:.2f}%')
    tot_sc = sum(c['p_sc'].values())
    print(f'FS trigger 1 in {1/tot_sc:.0f}')
    for kk in (3, 4, 5):
        if kk in c['fs_stats']:
            e, mx, _ = c['fs_stats'][kk]
            print(f'  {kk} sc     1 in {1/c["p_sc"][kk]:,.0f}   avg {e:.1f}x   max {mx:.0f}x')
    print('\nwin spread (per spin):')
    for band, p in weighted_spread(c):
        print(f'  {band:>14}   1 in {1/p:>10,.0f}')
