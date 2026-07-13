# Vice Heat — custom math model (for dev review)

> **Für Noski:** Unser eigenes 96%-Modell auf 5×5 — alles zahlt ab 3er,
> TIERED Bonus (3 Scatter = Expanding, 4+ Scatter = STICKY Expanding, Cap 2),
> Hot-Spin im Base Game. 8M-Sim-zertifiziert. Dieses Paket geht so an den Dev.

## The model (5×5 · 3125 ways · RTP 96.0%)

- **Every symbol pays from 3-of-a-kind** (base game connects constantly — measured hit frequency **85.5%**).
- **Wilds only on reels 2–5** (reel 1 clean → no wild-line double counting; the same gate the current template uses).
- **TIERED FREE SPINS** (8 spins, +5 retrigger, cap 50):
  - **3 scatters (1-in-26.4):** per-spin expanding wilds — every wild-carrying
    reel becomes FULLY WILD before ways evaluation, for that spin only.
    Avg round ≈ **14.5×**.
  - **4+ scatters (1-in-145.5):** **STICKY expanding wilds** — the FIRST **2**
    wild-landing reels become permanent full-wild towers for the rest of the
    round (leftmost joins first on ties); later wilds play as regular 1:1
    wilds. Avg round ≈ **31.9×**.
  - Fully wild reels show only wilds → they contribute **no scatters**
    (retriggers get naturally rarer as towers stand).
- **HOT SPIN (base game):** 1-in-40 base spins play in per-spin expansion mode — presented as the "screen darkens" special spin.
- Session cap 5000×, min wager 10000 — template invariants unchanged.

## The numbers (8,000,000-spin certification, k = 1.1476)

| Metric | Value |
|---|---|
| RTP | **96.15%** (alt-seed 1M sanity: 95.37 — fs4 tail noise) |
| Hit frequency | 85.5% |
| FS trigger (3 sc) | 1-in-26.4 · avg round 14.5× |
| FS trigger (4+ sc, sticky) | 1-in-145.5 · avg round 31.9× |
| RTP split | base 15.8% · hot 3.5% · fs3 54.9% · fs4 21.9% |

**Why the sticky cap:** uncapped sticky-4 explodes — towers accumulate to a
near-full-wild board by mid-round (avg round **317×**, fs4 alone worth 217%
RTP at k=1); fitting 96% would gut every other pay to 34%. Cap 2 keeps the
fantasy (two permanent towers) at avg 31.9× and lets the paytable GROW
(k = 1.1476 > 1).

**Method:** MC certification (8M spins) — the sticky rounds are a Markov
process over the tower set, which breaks the per-spin analytic factorisation.
`analytic_vice_heat.py` still reproduces the per-spin-expansion branch
exactly and remains the cross-check for base game + 3-scatter rounds.
Final gate runs dev-side as usual (5M bigint validator, ±0.10%).

## Files

- `vice_heat_expanding.json` — the manifest, standard shape (reelStrips,
  payTable, scatterPay, FS params, minWager, maxWin) + a `custom` block for
  the three rules (`expandingWildsInFreeSpins`,
  `stickyExpandingFrom4Scatters` + `stickyTowerCap: 2`, `hotSpinChance1In: 40`).
- `analytic_vice_heat.py` — exact RTP derivation of the per-spin branch.
- `simulate_vice_heat.py` — full MC simulator incl. tiered sticky rounds,
  FS retriggers + session cap. `VH_ROWS`/`VH_STICKY_CAP`/`VH_K` env params.

## What the dev needs to add (contract side)

Three settlement rules beyond the current template (all deterministic from the
spin randomness, no new RNG):
1. **FS expansion:** in FS resolution, reels containing ≥1 wild evaluate with
   count = ROWS for every symbol (full-wild reel). Full-wild reels contribute
   no scatters.
2. **Sticky tier:** when the TRIGGER board had ≥4 scatters, keep a sticky set
   across the round's spins: the first 2 reels to carry a wild join it
   (leftmost first) and evaluate full-wild for every remaining spin; wilds on
   other reels stay regular symbols (no per-spin expansion in sticky rounds).
3. **Hot spin:** derive a 1-in-40 flag from the existing spin seed; when set,
   apply the per-spin expansion rule to a base spin.
Everything else (strips, paytable, ways evaluation, caps) is the unchanged
template pipeline — render TS+Sol from the manifest as usual and re-run the
5M gate on the bigint simulator.
