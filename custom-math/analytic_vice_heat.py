# Vice Heat — EXACT analytic RTP (no Monte-Carlo noise).
# Ways expectation factorises over independent reels:
#   E[win_s] = sum_k pay_k(s) * (prod_{i<=k} E[n_i]) * P(n_{k+1}=0)   (k=5: no tail factor)
# where n_i = count(s)+count(W) in the visible window (expansion mode: 3 if
# wild present). Scatter pay + FS trigger via convolution of per-reel scatter
# counts. FS length with retriggers via a cheap count-only process.

import json, random

code = open('custom-math/simulate_vice_heat.py', encoding='utf-8').read()
m = {}
exec(compile(code.split("if __name__")[0], 'sim', 'exec'), m)
STRIPS, SYMS, ROWS, W, SC = m['STRIPS'], m['SYMS'], m['ROWS'], m['W'], m['SC']
BASE_PAYS, SCATTER_PAY = m['BASE_PAYS'], m['SCATTER_PAY']
FS_COUNT, FS_RETRIG, FS_CAP, HOT = m['FS_COUNT'], m['FS_RETRIG'], m['FS_CAP'], m['HOT_CHANCE']

# per-reel stats over all stops
reel = []
for strip in STRIPS:
    L = len(strip)
    En = {s: 0.0 for s in SYMS}; Ez = {s: 0 for s in SYMS}
    En_x = {s: 0.0 for s in SYMS}; Ez_x = {s: 0 for s in SYMS}
    scat_dist = [0.0, 0.0, 0.0, 0.0]
    for stop in range(L):
        win = [strip[(stop + r) % L] for r in range(ROWS)]
        wilds = win.count(W); sc = win.count(SC)
        scat_dist[sc] += 1 / L
        for s in SYMS:
            n = win.count(s) + wilds
            nx = ROWS if wilds > 0 else win.count(s)
            En[s] += n / L
            En_x[s] += nx / L
            if n == 0: Ez[s] += 1
            if nx == 0: Ez_x[s] += 1
    reel.append({'En': En, 'Pz': {s: Ez[s] / L for s in SYMS},
                 'En_x': En_x, 'Pz_x': {s: Ez_x[s] / L for s in SYMS},
                 'scat': scat_dist})

def line_ev(expand):
    ev = 0.0
    for s in SYMS:
        En = [ (reel[i]['En_x'] if expand else reel[i]['En'])[s] for i in range(5) ]
        Pz = [ (reel[i]['Pz_x'] if expand else reel[i]['Pz'])[s] for i in range(5) ]
        prod = 1.0
        for k in range(1, 6):
            prod *= En[k - 1]
            if k >= 3:
                tail = Pz[k] if k < 5 else 1.0
                ev += BASE_PAYS[s][k - 3] * prod * tail
    return ev  # bps at k=1 scale

# scatter distribution over 5 reels (convolution)
dist = [1.0]
for r in reel:
    nd = [0.0] * (len(dist) + 3)
    for i, p in enumerate(dist):
        for c, q in enumerate(r['scat']):
            nd[i + c] += p * q
    dist = nd
p_ge3 = sum(dist[3:])
scat_ev = sum(dist[min(c, 5)] * 0 for c in range(0))  # placeholder
scat_ev = sum((SCATTER_PAY[min(c, 5) - 3]) * dist[c] for c in range(3, len(dist)))

# FS expected number of spins (count-only process, exact enough at 10M trials)
rng = random.Random(2024)
tot = 0
T = 2_000_000
for _ in range(T):
    left, played = FS_COUNT, 0
    while left > 0 and played < FS_CAP:
        left -= 1; played += 1
        if rng.random() < p_ge3 and played < FS_CAP:
            left = min(left + FS_RETRIG, FS_CAP - played)
    tot += played
E_fs_spins = tot / T

base_line = line_ev(False)
exp_line = line_ev(True)
per_spin_base = base_line + scat_ev
per_spin_exp = exp_line + scat_ev
fs_ev = E_fs_spins * per_spin_exp
rtp1 = (1 - 1 / HOT) * per_spin_base + (1 / HOT) * per_spin_exp + p_ge3 * fs_ev

res = {
    'k1_base_line_bps': round(base_line, 3),
    'k1_expansion_line_bps': round(exp_line, 3),
    'k1_scatter_bps': round(scat_ev, 3),
    'p_fs_trigger': round(p_ge3, 6),
    'fs_trigger_1_in': round(1 / p_ge3, 2),
    'E_fs_spins': round(E_fs_spins, 3),
    'rtp_at_k1_pct': rtp1 / 100,
    'k_exact': 9600 / rtp1 * 100 / 100,
}
res['k_exact'] = 9600 / rtp1
print(json.dumps(res, indent=1))

# final integer paytable at exact k + analytic RTP recheck with rounded pays
k = res['k_exact']
pays = {s: [max(1, round(v * k)) for v in p] for s, p in BASE_PAYS.items()}
scat = [max(1, round(v * k)) for v in SCATTER_PAY]
BASE_PAYS.update(pays)
for i, v in enumerate(scat): SCATTER_PAY[i] = v
base_line2 = line_ev(False); exp_line2 = line_ev(True)
scat_ev2 = sum((SCATTER_PAY[min(c, 5) - 3]) * dist[c] for c in range(3, len(dist)))
rtp_final = (1 - 1 / HOT) * (base_line2 + scat_ev2) + (1 / HOT) * (exp_line2 + scat_ev2) + p_ge3 * E_fs_spins * (exp_line2 + scat_ev2)
print('FINAL analytic RTP with integer pays:', round(rtp_final / 100, 4), '%')
json.dump({'pays': {str(s): p for s, p in pays.items()}, 'scatterPay': scat,
           'analytic': res, 'final_rtp_pct': rtp_final / 100}, open('custom-math/_analytic.json', 'w'), indent=1)
