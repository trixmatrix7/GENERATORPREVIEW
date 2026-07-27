# How does MAX WIN actually happen in the CERTIFIED Vice FS config?
# Reproduces the shipping config (k=1.13, sticky cap 5, FS strips 120-stop,
# 7/10 spins) and, for real 4sc + 3sc rounds, records:
#   - max-win rate
#   - how many wild TOWERS were standing when the cap was hit
#   - what share of max-wins came from the 5-full-board INSTANT trigger
# Answers Noski's worry that max win came "through 2 towers + 1:1 wilds".
import os
os.environ['VH_STICKY_CAP']   = '5'
os.environ['VH_FS_STRIP_LEN'] = '120'
os.environ['VH_STICKY_SPINS'] = '10'
os.environ['VH_FS_SPINS']     = '7'
import sys, random
sys.path.insert(0, r'C:\Users\noski\Downloads\GENERATOR PREVIEW\custom-math')
import simulate_vice_heat_v2 as V

k = 1.13
pays = {s: [max(1, round(v * k)) for v in p] for s, p in V.BASE_PAYS.items()}
scat = [max(1, round(v * k)) for v in V.SCATTER_PAY]
CAPX = V.MAX_WIN_X * 10000
print('config check: pays[wild/A] =', pays[2], '(config json = [1243,2034,3616])')
print('STICKY_CAP =', V.STICKY_CAP, '| FS_LEN =', V.FS_LENS[0], '| sticky spins =', V.FS_COUNT_STICKY, '| 3sc spins =', V.FS_COUNT)

def run_sticky_round(rng):
    """One 4sc STICKY round. Returns (capped_win, hit_max, towers_at_max, via5full)."""
    sticky = set(); session = 0; fs_left = V.FS_COUNT_STICKY; cap = V.FS_CAP_STICKY; fs_played = 0
    hit_max = False; towers_at_max = None; via5 = False
    while fs_left > 0 and fs_played < cap:
        fs_left -= 1; fs_played += 1
        st = [rng.randrange(V.FS_LENS[r]) for r in range(V.REELS)]
        for i in range(V.REELS):
            if len(sticky) >= V.STICKY_CAP: break
            if i not in sticky and V.FS_PRE[i][st[i]][1] > 0: sticky.add(i)
        w2, sc2, full = V.eval_spin(st, False, sticky, pays, scat, V.FS_PRE)
        if w2 >= CAPX and len(full) >= V.REELS: via5 = True   # 5-full-board instant
        session += w2
        if session >= CAPX:
            hit_max = True; towers_at_max = len(sticky); break
        if sc2 >= 3 and fs_played < cap: fs_left = min(fs_left + V.FS_RETRIG, cap - fs_played)
    return min(session, CAPX), hit_max, towers_at_max, via5

def run_perspin_round(rng):
    """One 3sc PER-SPIN round. Returns (capped_win, hit_max, via5full)."""
    session = 0; fs_left = V.FS_COUNT; cap = V.FS_CAP; fs_played = 0
    hit_max = False; via5 = False
    while fs_left > 0 and fs_played < cap:
        fs_left -= 1; fs_played += 1
        st = [rng.randrange(V.FS_LENS[r]) for r in range(V.REELS)]
        w2, sc2, full = V.eval_spin(st, True, set(), pays, scat, V.FS_PRE)
        if w2 >= CAPX and len(full) >= V.REELS: via5 = True
        session += w2
        if session >= CAPX: hit_max = True; break
        if sc2 >= 3 and fs_played < cap: fs_left = min(fs_left + V.FS_RETRIG, cap - fs_played)
    return min(session, CAPX), hit_max, via5

rng = random.Random(20240727)
N = 1_000_000
import functools
print = functools.partial(print, flush=True)

# ---- 4sc sticky ----
mx = 0; via5 = 0; towers = {}; wins = []
for _ in range(N):
    w, hit, tw, v5 = run_sticky_round(rng)
    wins.append(w)
    if hit:
        mx += 1
        if v5: via5 += 1
        towers[tw] = towers.get(tw, 0) + 1
avg4 = sum(wins) / len(wins) / 10000
print('\n=== 4-SCATTER STICKY ROUND (n=%d) ===' % N)
print('avg round win: %.1fx | max-win rate: %.4f%% (1 in %s)' % (avg4, mx/N*100, f'{round(N/max(1,mx)):,}'))
print('of max-wins -> via 5-full-board INSTANT: %.1f%%  | via accumulation: %.1f%%' % (via5/max(1,mx)*100, (mx-via5)/max(1,mx)*100))
print('towers standing when cap hit:', dict(sorted(towers.items())))

# ---- 3sc per-spin ----
mx3 = 0; via5_3 = 0; wins3 = []
for _ in range(N):
    w, hit, v5 = run_perspin_round(rng)
    wins3.append(w)
    if hit:
        mx3 += 1
        if v5: via5_3 += 1
avg3 = sum(wins3) / len(wins3) / 10000
print('\n=== 3-SCATTER PER-SPIN ROUND (n=%d) ===' % N)
print('avg round win: %.1fx | max-win rate: %.5f%% (1 in %s)' % (avg3, mx3/N*100, f'{round(N/max(1,mx3)):,}' if mx3 else 'never'))
print('of max-wins -> via 5-full-board INSTANT: %.1f%%' % (via5_3/max(1,mx3)*100 if mx3 else 0))
