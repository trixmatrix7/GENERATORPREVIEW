"""Crack Farm PLANT BET-ENHANCER (base-game, Hacksaw-style).

Each enhanced spin GUARANTEES k plants (1/2/3 for the 5/10/20 tiers) landing
on random reels, each carrying a random multi from the FS pool (powers of 2,
1..1024) weighted LOW. Plants are full-reel wilds; a payline pays x the HIGHEST
plant it crosses (same rule as FS). Single spin, NO doubling. Win capped 5000x.

Prices the tiers so RTP = 96% and reports the multi/plant/win spread + how often
max-win (5000x) is reachable. Reuses the certified v2 strips + paytable.
"""
import importlib.util, os, random
HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('cf2', os.path.join(HERE, 'simulate_crack_farm_v2.py'))
cf2 = importlib.util.module_from_spec(spec)
import sys; sys.argv = ['cf2']
spec.loader.exec_module(cf2)

STRIPS, LENS, REELS, ROWS, W, SC = cf2.STRIPS, cf2.LENS, cf2.REELS, cf2.ROWS, cf2.W, cf2.SC
window, eval_lines = cf2.window, cf2.eval_lines
PLANT_REELS = cf2.PLANT_REELS

# LIVE paytable for the 5000x version (BASE_PAYS x k, k=0.2755 from emit).
K = 0.2755
PAYS = {s: [int(round(v * K)) for v in vals] for s, vals in cf2.BASE_PAYS.items()}
SCAT = [int(round(v * K)) for v in cf2.SCATTER_PAY]

CAP_BPS = 5000 * 10000   # 5000x total bet

# FS pool (powers of 2). Tier prices are ~50/100/150x bet (5/10/15 EUR @0.10),
# so ONE plant must return ~48x bet EV at 96% -> the pool has to be multi-heavy.
# Kept a real low tail so plenty of plants still land small ("sometimes big").
POOL    = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024]
WEIGHTS = [1500, 1300, 1000, 780, 560, 420, 320, 260, 340, 600, 1450]

def pick_multi(rng):
    t = sum(WEIGHTS); x = rng.randrange(t); a = 0
    for m, w in zip(POOL, WEIGHTS):
        a += w
        if x < a: return m
    return 1

def enhancer_spin(rng, k):
    """One enhanced base spin with k guaranteed plants. Each plant pays its OWN
    line-connection x its multi, INDEPENDENTLY (only that plant is wild for its
    own eval), so k plants ~= k x one plant -> tier prices stay linear. Win bps,
    capped 5000x."""
    spots = rng.sample(PLANT_REELS, min(k, REELS))
    multis = {r: pick_multi(rng) for r in spots}
    stops = [rng.randrange(LENS[r]) for r in range(REELS)]
    base = [[window(r, stops[r])[row] for r in range(REELS)] for row in range(ROWS)]
    total = 0
    for pr, mult in multis.items():
        b = [row[:] for row in base]           # only THIS plant is wild
        for row in range(ROWS):
            b[row][pr] = W
        _, _, lines = eval_lines(b, PAYS, SCAT, {pr: mult})
        for lw, crossed in lines:
            if pr in crossed:
                total += lw * mult
    return min(total, CAP_BPS)

def run(k, n, seed=7):
    rng = random.Random(seed)
    tot = 0; wins = []; maxw = 0; hits = 0; capped = 0
    for _ in range(n):
        w = enhancer_spin(rng, k)
        tot += w; wins.append(w)
        if w > 0: hits += 1
        maxw = max(maxw, w)
        if w >= CAP_BPS: capped += 1
    ev_x = tot / n / 10000.0     # mean win in x-bet
    return ev_x, hits / n, maxw / 10000.0, capped, wins

print(f"pool avg multi = {sum(m*w for m,w in zip(POOL,WEIGHTS))/sum(WEIGHTS):.2f}")
# target per-spin PRICE in x-bet for each tier (5/10/15 EUR at 0.10 base).
TARGET_PRICE_X = {1: 50, 2: 100, 3: 150}
N = 2_000_000
for k in (1, 2, 3):
    ev, hit, mx, capped, wins = run(k, N)
    price_x = ev / 0.96          # x-bet cost that WOULD hold exactly 96%
    tgt = TARGET_PRICE_X[k]
    rtp_at_target = ev / tgt * 100
    print(f"\n--- {k} plant(s)  (target {tgt}x bet = {tgt*0.10:.0f} EUR @0.10) ---")
    print(f"  EV per spin      = {ev:.3f}x bet   (hit rate {hit*100:.1f}%)")
    print(f"  RTP at {tgt}x price = {rtp_at_target:.1f}%   (fair price for 96% = {price_x:.1f}x bet)")
    print(f"  biggest win seen = {mx:.0f}x   (5000x-cap hits: {capped} in {N:,} = 1 in {N//max(capped,1):,})")
    # win-band spread
    import numpy as np
    a = np.array(wins)/10000.0
    for lo,hi,lbl in [(0,1,'<1x'),(1,10,'1-10x'),(10,50,'10-50x'),(50,200,'50-200x'),(200,1000,'200-1000x'),(1000,5001,'1000x+')]:
        print(f"    {lbl:9s}: {((a>=lo)&(a<hi)).mean()*100:6.3f}%")
