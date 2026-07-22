# Vice Heat — calibrate SEPARATE FS reel strips for the two bonus buys.
# buy3 (100x): FS-round EV target 94.0x  (band 92.6-95.1) -> ADD wilds
# buy4 (200x): FS-round EV target 188.6x (band 185-190.6) -> REMOVE wilds
# The buys' forced base board is priced separately (0.951x / 1.381x) and the
# natural game keeps the certified strips untouched.
#
# Deterministic strip rules (same family as build_ante_strips in
# certify_vice_buys_ante.py):
#   ADD  k wilds to a strip: anchor p0 = existing wild position (reel 0 has
#        none -> its scatter position). Targets t_j = (p0 + round(j*L/(k+1)))%L
#        for j=1..k. At each target scan outward (t, t+1, t-1, ...) for the
#        nearest stop holding the CURRENTLY most common LOW (6/7/8, tie ->
#        lower id) and replace it with WILD. Mode recomputed per replacement.
#   REMOVE k wilds from a strip: take the first wild position(s) in strip
#        order and replace each with the CURRENTLY least common LOW (tie ->
#        lower id), recomputed per removal.
# Scatter counts per strip are asserted unchanged (retriggers keep working).
#
# forced_round(strips, n, scatters, seed) from certify_vice_buys_ante is the
# certified engine (retriggers, sticky cap 3, FS caps 10/13, 5000x session
# cap, trigger scatterPay seed). It uses ONE strips set; the trigger seed is
# the constant SCATTER_PAY so the passed strips shape only the FS spins.
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import certify_vice_buys_ante as C

W, SC = 0, 1
LOWS = [6, 7, 8]


def add_wilds(strips, per_strip):
    out, log = [], []
    for r, strip in enumerate(strips):
        s = list(strip)
        L = len(s)
        wpos = [i for i, v in enumerate(s) if v == W]
        p0 = wpos[0] if wpos else [i for i, v in enumerate(s) if v == SC][0]
        k = per_strip[r]
        placed = []
        for j in range(1, k + 1):
            t = (p0 + round(j * L / (k + 1))) % L
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
            s[pos] = W
            placed.append({'target': t, 'replacedAt': pos, 'replacedSym': mode})
        assert s.count(SC) == strip.count(SC)
        log.append({'reel': r, 'anchor': p0, 'added': placed,
                    'wildsBefore': len(wpos), 'wildsAfter': s.count(W)})
        out.append(s)
    return out, log


def remove_wilds(strips, per_strip):
    out, log = [], []
    for r, strip in enumerate(strips):
        s = list(strip)
        k = per_strip[r]
        removed = []
        for _ in range(k):
            wpos = [i for i, v in enumerate(s) if v == W]
            if not wpos:
                break
            pos = wpos[0]
            counts = {sym: s.count(sym) for sym in LOWS}
            least = min(LOWS, key=lambda sym: (counts[sym], sym))
            s[pos] = least
            removed.append({'removedAt': pos, 'replacedWith': least})
        assert s.count(SC) == strip.count(SC)
        log.append({'reel': r, 'removed': removed,
                    'wildsBefore': strip.count(W), 'wildsAfter': s.count(W)})
        out.append(s)
    return out, log


PAY_SYMS = [2, 3, 4, 5]


def demote_pays(strips, per_strip):
    """Fine trim dial: replace the currently most common PAY symbol (2..5,
    tie -> lower id) with the currently least common LOW (tie -> lower id) at
    evenly spread targets around the strip anchor (wild pos, else scatter).
    Wild and scatter counts untouched."""
    out, log = [], []
    for r, strip in enumerate(strips):
        s = list(strip)
        L = len(s)
        wpos = [i for i, v in enumerate(s) if v == W]
        p0 = wpos[0] if wpos else [i for i, v in enumerate(s) if v == SC][0]
        k = per_strip[r]
        demoted = []
        for j in range(1, k + 1):
            t = (p0 + round(j * L / (k + 1))) % L
            # highest-pay symbol still present on the strip (2=highA first)
            mode = next(sym for sym in PAY_SYMS if s.count(sym) > 0)
            lc = {sym: s.count(sym) for sym in LOWS}
            least = min(LOWS, key=lambda sym: (lc[sym], sym))
            pos = None
            for d in range(L):
                for cand in ((t + d) % L, (t - d) % L):
                    if s[cand] == mode:
                        pos = cand
                        break
                if pos is not None:
                    break
            s[pos] = least
            demoted.append({'target': t, 'replacedAt': pos,
                            'demoted': mode, 'to': least})
        assert s.count(SC) == strip.count(SC) and s.count(W) == strip.count(W)
        log.append({'reel': r, 'demoted': demoted})
        out.append(s)
    return out, log


def pad_strip(strips, reel, n_pad):
    """Fine trim dial for the sticky round: lengthen ONE strip by evenly
    interleaving n_pad copies of the currently least common LOW (tie -> lower
    id, recomputed per insertion). Dilutes that reel's wild (and scatter)
    frequency 40/(40+n) without touching symbol counts -> a continuous
    interpolation between 'wild present' and 'wild removed'."""
    out = [list(s) for s in strips]
    s = out[reel]
    L0 = len(s)
    new = []
    acc = 0.0
    inserted = []
    for i, v in enumerate(s):
        new.append(v)
        acc += n_pad / L0
        while acc >= 1.0:
            lc = {sym: new.count(sym) + s[i + 1:].count(sym) for sym in LOWS}
            least = min(LOWS, key=lambda sym: (lc[sym], sym))
            new.append(least)
            inserted.append({'afterOrigIdx': i, 'sym': least})
            acc -= 1.0
    assert new.count(SC) == s.count(SC) and new.count(W) == s.count(W)
    out[reel] = new
    return out, {'reel': reel, 'padded': n_pad, 'newLen': len(new),
                 'inserted': inserted}


def wilds_per_strip(strips):
    return [s.count(W) for s in strips]


def run(tag, strips, scatters, n, seed):
    res = C.forced_round(strips, n, scatters, seed)
    print(f'{tag}: wilds={wilds_per_strip(strips)} n={n} '
          f'ev={res["ev_x"]:.3f} +-{res["ci99_x"]:.3f} (99% CI)', flush=True)
    return res


if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'sweep3'
    S = C.STRIPS

    if mode == 'sweep3':
        for w in (1, 2, 3):
            strips, _ = add_wilds(S, [w] * 5)
            run(f'buy3 w={w}/strip', strips, 3, 40000, seed=1000 + w)

    elif mode == 'fine3':
        # args: explicit per-strip add-counts as comma lists, e.g. 1,0,0,0,0
        for spec in sys.argv[2:]:
            per = [int(x) for x in spec.split(',')]
            strips, _ = add_wilds(S, per)
            run(f'buy3 per-add={per}', strips, 3, 60000,
                seed=2000 + sum(v * 5 ** i for i, v in enumerate(per)))

    elif mode == 'confirm3':
        # args: addSpec [padReel:padN] n
        per = [int(x) for x in sys.argv[2].split(',')]
        pad_spec = sys.argv[3] if len(sys.argv) > 3 and ':' in sys.argv[3] else None
        n = int(sys.argv[-1]) if sys.argv[-1].isdigit() else 200000
        strips, log = add_wilds(S, per)
        pad_log = None
        if pad_spec:
            pr, pn = [int(x) for x in pad_spec.split(':')]
            strips, pad_log = pad_strip(strips, pr, pn)
        res = run(f'buy3 CONFIRM add={per} pad={pad_spec}', strips, 3, n, seed=31337)
        rule = ('buy3 FS strips: add wilds per strip (counts %s) replacing the '
                'currently most common LOW (6/7/8, tie->lower id) at the stop '
                'nearest to evenly spread targets p0+round(j*L/(k+1)) around the '
                'existing wild (reel 0: around its scatter); mode recomputed per '
                'replacement; %s; scatter counts unchanged'
                % (per, ('then reel %d strip evenly padded with %d least-common-LOW '
                         'stops to fine-trim wild frequency' % (pr, pn)) if pad_spec
                   else 'no padding'))
        with open(os.path.join(HERE, 'vice_buy3_fs_strips.json'), 'w', encoding='utf-8') as f:
            json.dump({'reelStrips': strips, 'rule': rule,
                       'log': log + ([pad_log] if pad_log else [])
                       + [{'confirm': res, 'wildsPerStrip': wilds_per_strip(strips),
                           'stripLens': [len(s) for s in strips]}]}, f, indent=1)
        print('vice_buy3_fs_strips.json written', flush=True)

    elif mode == 'sweep4':
        for j in (1, 2, 3, 4):
            per = [0] + [1 if r <= j else 0 for r in range(1, 5)]
            strips, _ = remove_wilds(S, per)
            run(f'buy4 remove j={j}', strips, 4, 40000, seed=4000 + j)

    elif mode == 'fine4':
        for spec in sys.argv[2:]:
            per = [int(x) for x in spec.split(',')]
            strips, _ = remove_wilds(S, per)
            run(f'buy4 per-remove={per}', strips, 4, 60000,
                seed=5000 + sum(v * 3 ** i for i, v in enumerate(per)))

    elif mode == 'trim4':
        # args: pairs "removeSpec:demoteSpec", e.g. 0,0,0,0,1:1,1,1,1,1
        for spec in sys.argv[2:]:
            rem_s, dem_s = spec.split(':')
            rem = [int(x) for x in rem_s.split(',')]
            dem = [int(x) for x in dem_s.split(',')]
            strips, _ = remove_wilds(S, rem)
            strips, _ = demote_pays(strips, dem)
            run(f'buy4 rem={rem} dem={dem}', strips, 4, 60000,
                seed=7000 + sum((r + 2 * a) * 11 ** i for i, (r, a) in enumerate(zip(rem, dem))))

    elif mode == 'trim3':
        # args: pairs "addSpec:demoteSpec"
        for spec in sys.argv[2:]:
            add_s, dem_s = spec.split(':')
            add = [int(x) for x in add_s.split(',')]
            dem = [int(x) for x in dem_s.split(',')]
            strips, _ = add_wilds(S, add)
            strips, _ = demote_pays(strips, dem)
            run(f'buy3 add={add} dem={dem}', strips, 3, 60000,
                seed=8000 + sum((r + 2 * a) * 13 ** i for i, (r, a) in enumerate(zip(add, dem))))

    elif mode == 'pad4':
        # args: pairs "reel:nPad", natural strips base
        for spec in sys.argv[2:]:
            reel, n_pad = [int(x) for x in spec.split(':')]
            strips, _ = pad_strip(S, reel, n_pad)
            run(f'buy4 pad reel{reel}+{n_pad}', strips, 4, 60000,
                seed=9000 + reel * 1000 + n_pad)

    elif mode == 'mix4':
        # args: pairs "removeSpec:addSpec", e.g. 0,0,1,0,0:0,0,0,0,1
        for spec in sys.argv[2:]:
            rem_s, add_s = spec.split(':')
            rem = [int(x) for x in rem_s.split(',')]
            add = [int(x) for x in add_s.split(',')]
            strips, _ = remove_wilds(S, rem)
            strips, _ = add_wilds(strips, add)
            run(f'buy4 rem={rem} add={add}', strips, 4, 60000,
                seed=6000 + sum((r + 2 * a) * 7 ** i for i, (r, a) in enumerate(zip(rem, add))))

    elif mode == 'confirm4':
        # args: padReel:padN n   (wild-frequency dilution, no removal)
        pr, pn = [int(x) for x in sys.argv[2].split(':')]
        n = int(sys.argv[3]) if len(sys.argv) > 3 else 150000
        strips, pad_log = pad_strip(S, pr, pn)
        res = run(f'buy4 CONFIRM pad reel{pr}+{pn}', strips, 4, n, seed=73331)
        rule = ('buy4 FS strips: natural strips with reel %d strip evenly padded '
                'with %d extra stops of the currently least common LOW (6/7/8, '
                'tie->lower id, recomputed per insertion), diluting that reel\'s '
                'wild frequency from 5/40 to 5/%d windows (continuous trim between '
                'wild-present 280.9x and wild-removed 163.9x); wild and scatter '
                'COUNTS per strip unchanged (retriggers keep working)'
                % (pr, pn, 40 + pn))
        with open(os.path.join(HERE, 'vice_buy4_fs_strips.json'), 'w', encoding='utf-8') as f:
            json.dump({'reelStrips': strips, 'rule': rule,
                       'log': [pad_log,
                               {'confirm': res, 'wildsPerStrip': wilds_per_strip(strips),
                                'stripLens': [len(s) for s in strips]}]}, f, indent=1)
        print('vice_buy4_fs_strips.json written', flush=True)

    print('DONE', flush=True)
