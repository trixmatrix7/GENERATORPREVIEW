# Vice Heat — bonus-buy + ante certification job.
# REUSES the certified engine logic from simulate_vice_heat.py (eval_spin /
# FS-round loop copied 1:1) but loads STRIPS + PAYS from the CERTIFIED
# manifest src/data/math_vice_heat.json (rtpBps 9599) instead of rebuilding.
#
# Deliverables:
#   A) base verification sim on manifest strips (RTP / trigger freqs / FS share)
#   B) forced 3-scatter FS round EV (expanding-wild round, 7 spins cap 10)
#   C) forced 4-scatter STICKY round EV (10 spins cap 13, tower cap 3)
#   D) ANTE strips (scatter count per strip TRIPLED, deterministic insertion
#      rule below) -> custom-math/vice_ante_strips.json + full-game sim on them
#
# ANTE insertion rule (deterministic):
#   For each strip (length L=40) with existing scatter at position p0 and
#   current scatter count c (=1 for all Vice Heat strips), insert k = 2*c
#   extra scatters. Target positions are spread evenly around the strip:
#   t_j = (p0 + round(j*L/(k+1))) % L for j = 1..k  (i.e. p0+13, p0+27).
#   At each target, scan outward (t, t+1, t-1, t+2, t-2, ...) for the nearest
#   stop holding the CURRENTLY most common LOW symbol (6/7/8 = lowE/F/G;
#   tie -> lower symbol id) and replace it with the scatter. The most-common
#   low is recomputed after every replacement.
import random, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MANIFEST = os.path.join(ROOT, 'src', 'data', 'math_vice_heat.json')

REELS, ROWS = 5, 5
W, SC = 0, 1
SYMS = [2, 3, 4, 5, 6, 7, 8]
LOWS = [6, 7, 8]

m = json.load(open(MANIFEST, encoding='utf-8'))
STRIPS = m['reelStrips']
PT = m['payTable']
PAYS = {2: PT['highA'], 3: PT['highB'], 4: PT['midC'], 5: PT['midD'],
        6: PT['lowE'], 7: PT['lowF'], 8: PT['lowG']}
SCATTER_PAY = m['scatterPay']
cu = m['custom']
FS_COUNT = m['freeSpinsCount']            # 7
FS_CAP = m['freeSpinsCap']                # 10
FS_RETRIG = m['retriggerSpins']           # 3
FS_COUNT_STICKY = cu['stickyRoundSpins']  # 10
FS_CAP_STICKY = cu['stickyRoundCap']      # 13
STICKY_CAP = cu['stickyTowerCap']         # 3
STICKY_FULL_MULT = cu['stickyFullBoardMultiplier']  # 1 (retired)
SIMUL_MULTS = {int(k): v for k, v in cu['simulExpandMultipliers'].items()}
HOT_CHANCE = cu['hotSpinChance1In']       # 80
MAX_WIN_X = m['maxWinMultiplier']         # 5000
X = 10000  # bps of bet


def precompute(strips):
    pre = []
    for strip in strips:
        L = len(strip)
        rows = []
        for stop in range(L):
            win = [strip[(stop + r) % L] for r in range(ROWS)]
            wilds = win.count(W)
            scat = win.count(SC)
            cnt = {s: win.count(s) + wilds for s in SYMS}
            rows.append((cnt, wilds, scat))
        pre.append(rows)
    return pre


def eval_spin(PRE, stops, per_spin_expand, sticky_set):
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
            win += PAYS[s][k - 3] * ways
    if scatters >= 3:
        win += SCATTER_PAY[min(scatters, 5) - 3]
    return win, scatters, full


def play_fs_round(PRE, lens, rng, sticky_round, session):
    """Plays one FS round exactly like the certified sim's in-line loop.
    `session` carries the trigger-spin win (max-win cap is on the session).
    Returns (round_win, session)."""
    sticky = set()
    round_win = 0
    fs_left = FS_COUNT_STICKY if sticky_round else FS_COUNT
    cap = FS_CAP_STICKY if sticky_round else FS_CAP
    fs_played = 0
    while fs_left > 0 and fs_played < cap:
        fs_left -= 1
        fs_played += 1
        st = [rng.randrange(lens[r]) for r in range(REELS)]
        if sticky_round:
            for i in range(REELS):
                if len(sticky) >= STICKY_CAP:
                    break
                if i not in sticky and PRE[i][st[i]][1] > 0:
                    sticky.add(i)
            w2, sc2, _ = eval_spin(PRE, st, False, sticky)
            if len(sticky) >= STICKY_CAP:
                w2 *= STICKY_FULL_MULT
        else:
            w2, sc2, full = eval_spin(PRE, st, True, sticky)
            w2 *= SIMUL_MULTS.get(len(full), 1)
        round_win += w2
        session += w2
        if session >= MAX_WIN_X * X:
            break
        if sc2 >= 3 and fs_played < cap:
            fs_left = min(fs_left + FS_RETRIG, cap - fs_played)
    return round_win, session


def simulate_full(strips, n, seed=42):
    """Full-game sim (base + hot + natural FS), mirrors certified simulate()."""
    PRE = precompute(strips)
    rng = random.Random(seed)
    lens = [len(s) for s in strips]
    total = 0
    total_sq = 0.0
    fs3_n = fs4_n = 0
    base_total = hot_total = fs3_total = fs4_total = 0
    empty = set()
    for _ in range(n):
        stops = [rng.randrange(lens[r]) for r in range(REELS)]
        hot = rng.randrange(HOT_CHANCE) == 0
        win, sc, full = eval_spin(PRE, stops, hot, empty)
        if hot:
            win *= SIMUL_MULTS.get(len(full), 1)
        session = win
        if hot:
            hot_total += win
        else:
            base_total += win
        if sc >= 3:
            sticky_round = sc >= 4
            round_win, session = play_fs_round(PRE, lens, rng, sticky_round, session)
            if sticky_round:
                fs4_total += round_win
                fs4_n += 1
            else:
                fs3_total += round_win
                fs3_n += 1
        if session > MAX_WIN_X * X:
            session = MAX_WIN_X * X
        total += session
        total_sq += (session / X) ** 2
    rtp = total / (n * X)
    var = max(0.0, total_sq / n - rtp * rtp)
    return {
        'n': n,
        'rtp_pct': rtp * 100,
        'rtp_ci99_pp': 2.576 * (var ** 0.5) / (n ** 0.5) * 100,
        'fs3_trigger_1_in': n / max(1, fs3_n),
        'fs4_trigger_1_in': n / max(1, fs4_n),
        'any_fs_trigger_1_in': n / max(1, fs3_n + fs4_n),
        'base_pct': base_total / (n * X) * 100,
        'hot_pct': hot_total / (n * X) * 100,
        'fs3_pct': fs3_total / (n * X) * 100,
        'fs4_pct': fs4_total / (n * X) * 100,
        'fs3_n': fs3_n, 'fs4_n': fs4_n,
    }


def forced_round(strips, n_rounds, scatters, seed):
    """EV of a FORCED trigger with `scatters` scatters. Includes the trigger
    scatterPay (the certified model pays it on the trigger spin) and the full
    round; session (scatterPay + round) is capped at MAX_WIN_X like the
    certified sim caps sessions."""
    PRE = precompute(strips)
    rng = random.Random(seed)
    lens = [len(s) for s in strips]
    trig_pay = SCATTER_PAY[min(scatters, 5) - 3]
    sticky_round = scatters >= 4
    total = 0
    total_sq = 0.0
    for _ in range(n_rounds):
        session = trig_pay
        _, session = play_fs_round(PRE, lens, rng, sticky_round, session)
        if session > MAX_WIN_X * X:
            session = MAX_WIN_X * X
        total += session
        total_sq += (session / X) ** 2
    ev = total / (n_rounds * X)
    var = max(0.0, total_sq / n_rounds - ev * ev)
    return {'n_rounds': n_rounds, 'ev_x': ev,
            'ci99_x': 2.576 * (var ** 0.5) / (n_rounds ** 0.5)}


def build_ante_strips(strips):
    ante = []
    log = []
    for r, strip in enumerate(strips):
        s = list(strip)
        L = len(s)
        sc_pos = [i for i, v in enumerate(s) if v == SC]
        c = len(sc_pos)
        k = 2 * c
        p0 = sc_pos[0]
        placed = []
        for j in range(1, k + 1):
            t = (p0 + round(j * L / (k + 1))) % L
            # currently most common low (tie -> lower symbol id)
            counts = {sym: s.count(sym) for sym in LOWS}
            mode = max(LOWS, key=lambda sym: (counts[sym], -sym))
            # outward scan for nearest instance of mode
            pos = None
            for d in range(L):
                for cand in ((t + d) % L, (t - d) % L):
                    if s[cand] == mode:
                        pos = cand
                        break
                if pos is not None:
                    break
            s[pos] = SC
            placed.append({'target': t, 'replacedAt': pos, 'replacedSym': mode})
        log.append({'reel': r, 'existingScatterAt': p0, 'inserted': placed,
                    'scatterCountBefore': c, 'scatterCountAfter': s.count(SC)})
        ante.append(s)
    return ante, log


if __name__ == '__main__':
    N_BASE = int(os.environ.get('VB_N_BASE', '4000000'))
    N_ANTE = int(os.environ.get('VB_N_ANTE', '2000000'))
    N_FS3 = int(os.environ.get('VB_N_FS3', '400000'))
    N_FS4 = int(os.environ.get('VB_N_FS4', '200000'))
    part = os.environ.get('VB_PART', 'all')

    def dump(name, obj):
        with open(os.path.join(HERE, f'_vb_{name}.json'), 'w', encoding='utf-8') as f:
            json.dump(obj, f, indent=1)
        print(name.upper() + ':', json.dumps(obj, indent=1), flush=True)

    if part in ('all', 'base'):
        dump('base', simulate_full(STRIPS, N_BASE, seed=99))
    if part in ('all', 'fs3'):
        dump('fs3', forced_round(STRIPS, N_FS3, 3, seed=101))
    if part in ('all', 'fs4'):
        dump('fs4', forced_round(STRIPS, N_FS4, 4, seed=202))
    if part in ('all', 'ante'):
        ante_strips, ante_log = build_ante_strips(STRIPS)
        with open(os.path.join(HERE, 'vice_ante_strips.json'), 'w', encoding='utf-8') as f:
            json.dump({'reelStrips': ante_strips,
                       'rule': 'scatter count per strip tripled; extra scatters replace the '
                               'currently most common LOW symbol (lowE/F/G, tie->lower id) at the '
                               'stop nearest to evenly spread targets p0+round(j*L/(k+1)) around '
                               'the existing scatter; recomputed after each replacement',
                       'insertionLog': ante_log}, f, indent=1)
        print('ante strips written', flush=True)
        dump('ante', simulate_full(ante_strips, N_ANTE, seed=77))
    print('DONE', flush=True)
