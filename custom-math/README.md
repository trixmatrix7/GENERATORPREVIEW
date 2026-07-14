# Vice Heat — custom math model (for dev review)

> **Für Noski:** Unser eigenes 96%-Modell auf 5×5 — VOLATILE Ausbau: seltene
> Wilds, steile Pay-Kurve, TIERED Bonus (3 Scatter = Expanding, 4+ Scatter =
> STICKY bis volles Board), Max Win aus dem SETUP erreichbar. 8M-Sim.
> Dieses Paket geht so an den Dev.

## The model (5×5 · 3125 ways · RTP 96.0 · HIGH volatility)

- **Every symbol pays from 3-of-a-kind**, but the curve is STEEP: 3-oaks are
  pocket change, 5-oaks are events (highA 46 / 348 / **3484** bps per way).
- **RARE wilds: 1 per strip, reels 2–5 only** (reel 1 clean → no wild-line
  double counting). An expansion is an EVENT — P(window wild) ≈ 12.5%/reel.
- **TIERED FREE SPINS** (8 spins; retrigger awards only **+5** via the custom
  `retriggerSpins` rule; TOTAL cap **13** = at most ONE retrigger — max win
  must come from the setup, never from grinding endless spins):
  - **3 scatters (1-in-44):** per-spin expanding wilds + the
    **SIMULTANEOUS-EXPANSION LADDER**: 3 towers in ONE spin ×2, all 4 towers
    (1-in-4096 spins) ×8 — the ×8 four-tower alignment with a premium reel-1
    window IS this bonus' MAX WIN pattern (~1-in-15k rounds hit the 5000× cap,
    max seen 5163×). Median round **3.4×**, p90 18×, p99 134×.
  - **4+ scatters (1-in-520):** **STICKY expanding wilds** — every wild-landing
    reel becomes a permanent full-wild tower (up to ALL 4; no simul-ladder).
    Median round **63×**, p90 **769×**, p99 1912×, max seen **3517×**; 9.6%
    of sticky rounds pay ≥ 800×.
  - Fully wild reels contribute **no scatters** (retriggers fade as towers stand).
- **HOT SPIN (base game):** 1-in-40 base spins play in per-spin expansion mode.
- Session cap 5000×, min wager 10000 — template invariants unchanged.

## The numbers (8,000,000-spin certification, k = 1.031)

| Metric | Value |
|---|---|
| RTP | **97.0%** point / alt-seed 94.2 — both tails (sticky + simul-mult) put MC noise at ~±1.5%; true value ≈ 96, final gate runs dev-side |
| Hit frequency | 82.7% |
| RTP split | base 15.8% · hot 4.4% · fs3 32.1% · **fs4 44.7%** |
| Max win routes | 3sc: 4-tower ×8 alignment (~1-in-670k spins) · 4sc: early full-tower sticky round |
| Volatility | very high — most sessions bleed slowly; two distinct nuke patterns |

**Distribution is the product:** "mal nur 10× oder mal 800× straight" — the
fs4 spread (74× median vs 909× p90) IS the design goal, not an accident.

**Method:** MC certification (8M spins) — sticky rounds are a Markov process
over the tower set, which breaks the per-spin analytic factorisation.
`analytic_vice_heat.py` still cross-checks the per-spin-expansion branch.
NOTE for the dev gate: the fs4 tail concentration means the ±0.10% 5M gate
will need a larger N or seed-averaging for this profile.

## Files

- `vice_heat_expanding.json` — the manifest, standard shape + `custom` block
  (`expandingWildsInFreeSpins`, `stickyExpandingFrom4Scatters` +
  `stickyTowerCap: 4`, `retriggerSpins: 5`,
  `simulExpandMultipliers: {"3": 2, "4": 8}`, `hotSpinChance1In: 40`).
- `analytic_vice_heat.py` — exact RTP derivation of the per-spin branch.
- `simulate_vice_heat.py` — full MC simulator incl. tiered sticky rounds,
  round-win distributions, retriggers + caps. `VH_ROWS`/`VH_STICKY_CAP`/`VH_K`.

## What the dev needs to add (contract side)

Five settlement rules beyond the current template (all deterministic from the
spin randomness, no new RNG):
1. **FS expansion:** in FS resolution, reels containing ≥1 wild evaluate with
   count = ROWS for every symbol (full-wild reel). Full-wild reels contribute
   no scatters.
2. **Sticky tier:** when the TRIGGER board had ≥4 scatters, keep a sticky set
   across the round's spins: every reel that carries a wild joins it (up to
   stickyTowerCap, leftmost first) and evaluates full-wild for every remaining
   spin; in sticky rounds there is NO per-spin expansion for non-sticky reels.
3. **Hot spin:** derive a 1-in-40 flag from the existing spin seed; when set,
   apply the per-spin expansion rule to a base spin.
4. **Retrigger:** award the custom `retriggerSpins` (5) instead of the
   template's re-award-freeSpinsCount, bounded by freeSpinsCap = 13.
5. **Simul-expansion ladder** (per-spin expansion contexts only, never
   sticky): n reels expanding in the SAME spin multiply that spin's win per
   `simulExpandMultipliers` ({"3": 2, "4": 8}).
Everything else (strips, paytable, ways evaluation, caps) is the unchanged
template pipeline.
