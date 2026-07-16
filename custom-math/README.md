# Vice Heat — custom math model (for dev review)

> **Für Noski:** ~96%-Modell auf 5×5, TIERED Bonus mit LÄNGEREN Runden
> (3 SC = **7** Spins, 4+ SC = **10** Sticky-Spins), Simul-Mult-Leiter,
> Hot-Spins, harter 5000×-Cap. 20M-Sim-zertifiziert. Dieses Paket geht so an
> den Dev.

## The model (5×5 · 3125 ways · RTP ~96%)

- **DISPLAY PAY FLOOR:** the smallest connection (single-way 3-oak lowG) pays
  **768 bps = 0.077× bet** → **$0.02 on a $0.20 spin** at 2 decimals. NOTE:
  this dropped from the old 0.10× floor — the longer 10-spin sticky round adds
  so much free EV that holding 0.10× would have forced RTP over 100%. 0.077×
  is the tightest floor that still shows $0.02 on a 20¢ bet while keeping the
  house edge. Scatter pay floored the same (768/1490/4471).
- **Per-way curve is FLAT-ish:** with 3125 ways the TOP comes from **ways mass
  × expansion × simul-mult**, not per-way steepness.
- **ANTI-CLUSTERED strips:** C/E/G heavy on reels 1/3/5, thin on 2/4; B/D/F
  inverted. 3-in-a-row chains break at the thin reel → hit rate **69%**.
  Wilds: 1 per strip, reels 2–5 only (reel 1 clean); scatters: 1 per strip.
  Wild art is a money-stack "W"; wild pays as highA.
- **TIERED FREE SPINS:**
  - **3 scatters (1-in-67): 7 spins** (was 5), per-spin expanding wilds + the
    **simul-expansion ladder** (3 reels expanding in ONE spin ×2, all 4 ×10).
    The ×10 four-reel alignment IS the game's **MAX WIN** pattern — the only
    route that reaches the 5000× cap (~0.028% of 3sc rounds). Avg round ~22×.
  - **4+ scatters (1-in-921): 10 spins** (was 5), STICKY expanding wilds up to
    **3 towers** (`stickyTowerCap` 3, was 4). This is the **high-AVERAGE**
    tier: avg round ~276×, but capped ~1370× (it does not reach the 5000×
    cap). The old FULL-HOUSE ×2 is **retired** (`stickyFullBoardMultiplier`
    1) — at 10 spins the ×2 over a full board compounded RTP past 105%.
  - Retrigger: +3 spins (custom rule), per-tier caps 10 / 13 — at most one
    retrigger.
  - Fully wild reels contribute no scatters.
- **HOT SPIN:** 1-in-80 base spins play per-spin expansion incl. the ladder.
- Session cap 5000×, min wager 10000 — template invariants unchanged.

## Design note — why 4sc no longer hits the 5000× cap

At 5 sticky spins the 4-tower FULL HOUSE ×2 was the max-win engine. Doubling
the round to 10 spins makes the full board form almost every round, so the ×2
compounded RTP to 105%+ (house loses). Taming it (cap 3 towers, ×2 off) makes
4sc the **reliable-big** tier (avg 276×) while the 5000× MAX WIN moves to the
3sc simul-×10 spike. Net: 3sc is "harder for a good win" (low avg) but keeps
the jackpot ceiling; 4sc pays better on average. This matches Noski's brief
("3 SC schwerer als 4 SC für guten Win, aber Max-Win möglich").

## The numbers (certification, k = 0.7452)

| Metric | Value |
|---|---|
| RTP | **~96%** — 12M cert 95.99% · 4-seed 20M mean **96.5% ±0.6** · alt-seed 1M 93.3% (heavy 3sc-spike tail keeps MC noise wide; house-positive) |
| Hit frequency | 69.3% |
| RTP split | base 29.6% · hot 4.2% · fs3 32.5% · fs4 30.0% |
| 3sc round | avg 21.8× · max 8390× (→ capped 5000×) · **0.028%/round hit the cap** |
| 4sc round | avg 276× · max ~1371× (high-average tier, below cap) |
| Max win route | 3sc: 4-reel simul-×10 spike (the only route to 5000×) |

## Files

- `vice_heat_expanding.json` — the manifest, standard shape + `custom` block
  (`stickyTowerCap: 3`, `retriggerSpins: 3`, `stickyRoundSpins: 10`,
  `stickyRoundCap: 13`, `simulExpandMultipliers: {"3": 2, "4": 10}`,
  `stickyFullBoardMultiplier: 1`, `hotSpinChance1In: 80`).
- `analytic_vice_heat.py` — exact RTP derivation of the per-spin branch
  (pre-floor model; MC is the certification method for the tiered rules).
- `simulate_vice_heat.py` — full MC simulator. Env params:
  `VH_ROWS`, `VH_FS_SPINS`/`VH_FS_CAP` (3sc), `VH_STICKY_SPINS`/
  `VH_STICKY_ROUND_CAP` (4sc), `VH_STICKY_CAP`, `VH_STICKY_FULL_MULT`,
  `VH_SIMUL3`/`VH_SIMUL4`, `VH_TARGET_RTP`, `VH_CERT_SEED`, `VH_K`.

## What the dev needs to add (contract side)

Seven settlement rules beyond the current template (all deterministic from
the spin randomness, no new RNG):
1. **FS expansion:** in FS resolution, reels containing ≥1 wild evaluate with
   count = ROWS for every symbol (full-wild reel). Full-wild reels contribute
   no scatters.
2. **Sticky tier:** when the TRIGGER board had ≥4 scatters, keep a sticky set
   across the round's spins: every wild-carrying reel joins it (up to
   stickyTowerCap **3**, leftmost first) and evaluates full-wild for every
   remaining spin; no per-spin expansion for non-sticky reels in sticky rounds.
3. **Per-tier round length:** 3sc rounds start with freeSpinsCount (**7**),
   sticky rounds with stickyRoundSpins (**10**); total caps freeSpinsCap (**10**)
   / stickyRoundCap (**13**).
4. **Retrigger:** award retriggerSpins (3) instead of re-awarding
   freeSpinsCount, bounded by the tier's cap.
5. **Simul-expansion ladder** (per-spin contexts only, never sticky): n reels
   expanding in the SAME spin multiply that spin's win per
   `simulExpandMultipliers` ({"3": 2, "4": 10}).
6. **Hot spin:** derive a 1-in-80 flag from the existing spin seed; when set,
   apply the per-spin expansion rule (incl. ladder) to a base spin.
7. **FULL HOUSE (sticky rounds only):** while the sticky set holds ALL
   `stickyTowerCap` reels, multiply every spin's win by
   `stickyFullBoardMultiplier` — currently **1** (feature off; the field stays
   in the contract so it can be re-enabled if round length is ever shortened).
Everything else (strips, paytable, ways evaluation, caps) is the unchanged
template pipeline.
