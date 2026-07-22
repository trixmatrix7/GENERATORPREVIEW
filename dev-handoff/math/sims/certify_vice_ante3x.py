# -*- coding: utf-8 -*-
# TRUE ~3x-FS-chance ante for Vice Heat.
# Tripling scatters gave a ~17x trigger chance (cubic scaling) — this run
# calibrates a MILD scatter add: +1 scatter on k of the 5 strips (density
# x(1 + k/5)), searching k for a natural-trigger multiplier closest to 3.0,
# then picks the ante costMult that lands the ante RTP in 94-96%.
# Reuses the certified engine from certify_vice_buys_ante.py verbatim.
import json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from certify_vice_buys_ante import (  # noqa: E402
    simulate_full, SC, LOWS, REELS,
)

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
manifest = json.load(open(os.path.join(ROOT, 'src/data/math_vice_heat.json'), encoding='utf-8'))
base_strips = manifest['reelStrips']

def add_one_scatter(strip):
    """Insert ONE extra scatter opposite the existing one, replacing the
    currently most common LOW (tie -> lower id) nearest the target — same
    deterministic rule family as the tripled-strips builder."""
    s = list(strip)
    L = len(s)
    p0 = next(i for i, v in enumerate(s) if v == SC)
    t = (p0 + L // 2) % L
    counts = {sym: s.count(sym) for sym in LOWS}
    mode = max(LOWS, key=lambda sym: (counts[sym], -sym))
    pos = None
    for d in range(L):
        for cand in ((t + d) % L, (t - d) % L):
            if s[cand] == mode:
                pos = cand
                break
        if pos is not None:
            break
    s[pos] = SC
    return s, {'insertedAt': pos, 'target': t, 'replaced': mode}

N = 2_000_000
base = simulate_full(base_strips, N, seed=101)
base_trig = base['fs3_n'] + base['fs4_n']
print('BASE: rtp %.2f%% trigger 1-in-%.1f' % (base['rtp_pct'], N / base_trig))

results = {}
for k in (1, 2, 3):
    strips = []
    log = []
    # add to the strips with the LOWEST index first (deterministic, documented)
    for r in range(REELS):
        if r < k:
            s2, info = add_one_scatter(base_strips[r])
            strips.append(s2)
            log.append({'reel': r, **info})
        else:
            strips.append(list(base_strips[r]))
    res = simulate_full(strips, N, seed=202 + k)
    res['rtp'] = res['rtp_pct'] / 100.0
    trig = res['fs3_n'] + res['fs4_n']
    mult = (trig / N) / (base_trig / N)
    results[k] = {'strips': strips, 'log': log, 'ev': res['rtp'], 'trigMult': mult,
                  'trigIn': N / trig, 'res': res}
    print('k=%d: EV %.3fx, trigger 1-in-%.1f (x%.2f)' % (k, res['rtp'], N / trig, mult))

# pick k closest to 3.0x
best_k = min(results, key=lambda k: abs(results[k]['trigMult'] - 3.0))
R = results[best_k]
# costMult candidates: clean steps of 0.05
cands = [round(0.05 * i, 2) for i in range(20, 121)]
ok = [(c, R['ev'] / c * 100) for c in cands if 94.0 <= R['ev'] / c * 100 <= 96.0]
best = min(ok, key=lambda t: abs(t[1] - 96.0)) if ok else None
print('CHOSEN k=%d trigX %.2f -> costMult %s rtp %.2f%%' % (best_k, R['trigMult'], best[0], best[1]))

out = {
    'rule': 'base strips + 1 extra scatter on the first %d of 5 strips (inserted opposite the existing scatter, replacing the most common LOW, tie->lower id)' % best_k,
    'insertionLog': R['log'],
    'reelStrips': R['strips'],
    'costMult': best[0],
    'rtpPct': round(best[1], 2),
    'triggerChanceX': round(R['trigMult'], 2),
    'naturalTriggerIn': round(N / base_trig, 1),
    'anteTriggerIn': round(R['trigIn'], 1),
    'anteEvX': round(R['ev'], 4),
    'rounds': N,
}
json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'vice_ante3x_certified.json'), 'w'), indent=1)
print('wrote vice_ante3x_certified.json')
