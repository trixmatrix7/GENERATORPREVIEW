# Vice Heat — custom math model (for dev review)

> **Für Noski:** 96%-Modell auf 5×5 mit hartem PAY-FLOOR (kleinste Connection
> = 0.10× Einsatz — nie wieder „+0.00"), anti-geclusterten Strips, TIERED
> Bonus (3 SC = Expanding, 4+ SC = STICKY), Simul-Mult-Leiter, Hot-Spins.
> 8M-Sim-zertifiziert. Dieses Paket geht so an den Dev.

## The model (5×5 · 3125 ways · RTP 96.0)

- **HARD PAY FLOOR:** every possible connection — single-way 3-oak lowG
  included — pays ≥ **1004 bps = 0.10× bet** ($0.02 on a $0.20 spin, always
  visible at 2 decimals). Scatter pay floored too (1004/1950/5850).
- **Per-way curve is FLAT-ish** (lowG 1004/1073/1268 → highA 1072/1755/3120):
  with 3125 ways the TOP comes from **ways mass × expansion × simul-mult**,
  not per-way steepness — a full-tower spin multiplies 625–3125 ways into
  the 5-oak row.
- **ANTI-CLUSTERED strips:** C/E/G run heavy on reels 1/3/5 and thin (2 ea.)
  on 2/4; B/D/F inverted. 3-in-a-row chains break at the thin reel → hit
  rate **69%** (was 83%) while landed hits carry multiple ways on the heavy
  reels. Fewer, MEANINGFUL wins fund the floor. Wilds: 1 per strip, reels
  2–5 only (reel 1 clean); scatters: 1 per strip everywhere.
- **TIERED FREE SPINS:**
  - **3 scatters (1-in-67): 5 spins**, per-spin expanding wilds + the
    **simul-expansion ladder** (3 towers in ONE spin ×2, all 4 ×8 — the ×8
    alignment with premium reel-1 windows is this bonus' MAX WIN pattern:
    max seen 6060×, ~1-in-4600 rounds ≥800×). Median round 4.8×, avg 19.3×.
  - **4+ scatters (1-in-904): 5 spins** (own custom count), STICKY expanding
    wilds up to ALL 4 towers — and **FULL HOUSE ×2**: while all 4 towers
    stand, every spin pays ×2 (`stickyFullBoardMultiplier`). Median 25×,
    p90 304×, p99 3249×, max 6070×; 6.2% of rounds ≥ 800×; **0.060% hit the
    5000× cap — 3.2× likelier than a 3sc round (0.019%)**, so the 4-scatter
    route is the max-win engine, as designed.
  - Retrigger: +3 spins (custom rule), per-tier caps 8 / 7 — at most one
    retrigger; max win comes from the SETUP, never from grinding.
  - Fully wild reels contribute no scatters.
- **HOT SPIN:** 1-in-80 base spins play per-spin expansion incl. the ladder.
- Session cap 5000×, min wager 10000 — template invariants unchanged.

## The numbers (6,000,000-spin certification, k = 0.975, FULL HOUSE ×2)

| Metric | Value |
|---|---|
| RTP | **93.4% ±3.0 (99% CI)** (alt-seed 1M: 93.0 — heavy ×2/×8 tails keep MC noise wide; house-safe below 96) |
| Hit frequency | 69.3% — and every hit pays ≥ 0.10× |
| RTP split | base 38.7% · hot 5.5% · fs3 28.6% · fs4 20.8% |
| Max win routes | 4sc: FULL-HOUSE sticky round (0.060%/round) · 3sc: 4-tower ×8 fluke (0.019%/round) |

## Files

- `vice_heat_expanding.json` — the manifest, standard shape + `custom` block
  (`expandingWildsInFreeSpins`, `stickyExpandingFrom4Scatters`,
  `stickyTowerCap: 4`, `retriggerSpins: 3`, `stickyRoundSpins: 5`,
  `stickyRoundCap: 7`, `simulExpandMultipliers: {"3": 2, "4": 8}`,
  `stickyFullBoardMultiplier: 2`, `hotSpinChance1In: 80`).
- `analytic_vice_heat.py` — exact RTP derivation of the per-spin branch
  (pre-floor model; MC is the certification method for the tiered rules).
- `simulate_vice_heat.py` — full MC simulator incl. tiered sticky rounds,
  round-win distributions, per-tier retriggers + caps.
  `VH_ROWS`/`VH_STICKY_CAP`/`VH_K`/`VH_STICKY_FULL_MULT`/`VH_STICKY_SPINS`/
  `VH_STICKY_ROUND_CAP` env params.

## What the dev needs to add (contract side)

Seven settlement rules beyond the current template (all deterministic from
the spin randomness, no new RNG):
1. **FS expansion:** in FS resolution, reels containing ≥1 wild evaluate with
   count = ROWS for every symbol (full-wild reel). Full-wild reels contribute
   no scatters.
2. **Sticky tier:** when the TRIGGER board had ≥4 scatters, keep a sticky set
   across the round's spins: every wild-carrying reel joins it (up to
   stickyTowerCap, leftmost first) and evaluates full-wild for every
   remaining spin; no per-spin expansion for non-sticky reels in sticky
   rounds.
3. **Per-tier round length:** 3sc rounds start with freeSpinsCount (5),
   sticky rounds with stickyRoundSpins (5); total caps freeSpinsCap (8) /
   stickyRoundCap (7).
4. **Retrigger:** award retriggerSpins (3) instead of re-awarding
   freeSpinsCount, bounded by the tier's cap.
5. **Simul-expansion ladder** (per-spin contexts only, never sticky): n reels
   expanding in the SAME spin multiply that spin's win per
   `simulExpandMultipliers` ({"3": 2, "4": 8}).
6. **Hot spin:** derive a 1-in-80 flag from the existing spin seed; when set,
   apply the per-spin expansion rule (incl. ladder) to a base spin.
7. **FULL HOUSE (sticky rounds only):** while the sticky set holds ALL
   `stickyTowerCap` (4) reels, multiply every spin's win by
   `stickyFullBoardMultiplier` (2) — applied after ways evaluation, before
   the session cap.
Everything else (strips, paytable, ways evaluation, caps) is the unchanged
template pipeline.
