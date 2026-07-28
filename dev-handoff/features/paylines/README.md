# Paylines pay model (10 lines, 5×3) — drop-in evaluator

> ## ⚠ NOT PART OF VICE HEAT — do not build this into Vice Heat
>
> This is the odd file out in a Vice Heat package. **Vice Heat is a 5×5 WAYS
> game.** `preset/vice-heat.chainwtf-preset.json` carries `math.manifest.gridId
> "5x5"`, no `payModel` key, no `paylines` array and no `custom.paylines` — its
> round is `features/round-core/` (ways, expanding wilds, tower multipliers).
> If you implement anything on this page while building Vice Heat you ship the
> wrong pay model **and** the wrong bonus, and the certified 96.46% is gone.
>
> Everything below describes **Crack Farm**, a separate 5×3 game that shares
> this repo's presentation stack. It is documented here because the payline
> evaluator is a reusable drop-in, not because Vice Heat uses it.
>
> **Crack Farm's math manifest is not in this package.** `dev-handoff/math/`
> holds Vice Heat math only. The Crack Farm manifest lives in the preview repo
> at `src/data/math_crack_farm.json` (5000× version; `_10k.json` / `_15k.json`
> are the 10 000×/15 000× variants). Every number below is quoted from it.

A classic **PAYLINES** win model as an alternative to the engine's ways
evaluation — used by the Crack Farm reference game. Universal: any 5×3 game
can adopt it by switching its pay model to `lines`.

## Rules (contract-portable)

- **10 fixed lines** (row index per reel, row 0 = top):
  `[1,1,1,1,1] [0,0,0,0,0] [2,2,2,2,2] [0,1,2,1,0] [2,1,0,1,2]
   [0,0,1,2,2] [2,2,1,0,0] [1,0,0,0,1] [1,2,2,2,1] [0,1,1,1,2]`
- **Leftmost-consecutive**: a line pays for the longest run of the same
  effective symbol starting at reel 0; 3+ matches pay `payTable[sym][n-3]`.
- **Wilds substitute**, and a line pays only its **HIGHEST interpretation**.
  Two runs are scored for every line and the bigger win is the one that pays
  (`paylineEval.ts:116-143`): (a) the *substitute* run, whose effective symbol
  is the first non-wild along the line, and (b) — whenever the line starts with
  at least one wild — the *wild-lead* run scored as HIGH_A. Scoring only (a)
  underpays: a shorter premium HIGH_A run can out-pay a longer low-symbol run
  (`W W W lowG x` = 2204 bps as HIGH_A vs 1102 bps as a 4-of-a-kind lowG).
  Never sum the two; take the max, one combination per line.
- **Scatter breaks a line** and never pays on lines; scatters pay ANYWHERE
  (count over the whole board), identical to the ways model, and 3+ scatters
  trigger the free spins.
- **Pay basis:** `payBps` = bps of the TOTAL bet per winning line (same basis
  as the ways model's per-way pay). The paytable must be tuned for lines — take
  it from the Crack Farm manifest `src/data/math_crack_farm.json` (`payModel:
  "lines"`, `custom.paylines: 10`), NOT from `dev-handoff/math/`, which is Vice
  Heat's ways math and will not certify against these rules. Crack Farm also
  ships its own `reelStrips` (`reelLength` 46, scatters thinned) — the FS
  trigger rate is a property of those strips, so port them with the paytable.
- Each winning line yields ONE combination with exactly one cell per reel —
  the win-line comet (features/win-line/) renders it as a single clean beam,
  line by line.

## Preview implementation (reference)

- `src/game/paylineEval.ts` — the evaluator (WinResult-shaped output, so the
  whole presentation stack works unchanged).
- `src/game/winEval.ts` — the façade every non-engine call site uses
  (mock settlement + display). The frozen ways engine stays byte-identical;
  the façade switches per game.
- `src/game/plantFeature.ts` — the base-game plant draw, derived from the
  STOPS so settlement and display reach the same plants without adding a field
  to the encoded game state (the decode is byte-identical to the dev repo and
  must not fork).
- Contract side: port `paylineEval.ts` 1:1 into the settlement (it is pure,
  deterministic, and mirrors `custom-math/simulate_crack_farm_v2.py` — the v2
  simulator; `simulate_crack_farm.py` without the suffix is the retired v1
  model, see the history banner below).

## Crack Farm PLANT feature — v2 (current)

All values below are read from `src/data/math_crack_farm.json` and implemented
in `src/dev/mockHost.ts` (settlement), `src/game/PixiApp.ts` (display) and
`src/game/plantFeature.ts` (base game). `custom.plantMultiMode` is
`"double-per-spin"` — that string is the switch that says you are on v2.

**Free spins — 3, 4 and 5 scatters play the IDENTICAL round.** There is no
per-tier round type any more; only the plants' STARTING multiplier differs.

- **Length:** 7 spins (`freeSpinsCount` 7 = `custom.stickyRoundSpins` 7).
- **Start multiplier** from `custom.plantStartMultipliers`:
  `{"3": 1, "4": 8, "5": 32}` — 3sc starts at 1× (no badge), 4sc at 8×,
  5sc at 32×.
- **Plant count:** 1..5, drawn ONCE at round start from
  `custom.plantCountWeights` `[575, 280, 130, 12, 3]` (so 1 plant is normal,
  3 occasional, 5 very rare). `custom.stickyTowerCap` is 5, not 3.
  Draw it once per ROUND — redrawing per spin re-rolls the round's volatility.
- **Plants RELOCATE every spin:** each standing plant sinks and rises again on
  a fresh seed-derived reel, and a wild landing on a wild-carrying reel adds one
  more plant until the drawn count is reached. Multipliers travel WITH the
  plants (strongest kept when the count shrinks). A plant is a feature overlay,
  so it may stand on ANY of the 5 reels — including reel 0, whose strip carries
  no wild. Restricting plants to wild-carrying reels caps a round at 4 plants
  and misses the certified RTP.
- **A line pays × the HIGHEST plant it crosses — never the product.**
  Multiplying every crossed plant together reads well on paper and is
  explosive: three 16× plants would be 4096× on one line, measured RTP 3125%
  (`simulate_crack_farm_v2.py:249-251`). Scatter pay is NOT multiplied by
  plants — scatter combinations pass through untouched.
- **Doubling:** every plant that took part in a spin then DOUBLES — once per
  SPIN, not once per line — capped at `custom.plantMultiCap` **1024**. Per-line
  doubling let a plant crossed by all 10 paylines jump 2^10 in one spin.
  `custom.plantMultiIncrement` (1) is a v1 leftover and is NOT read on this
  path; do not implement a shared +1 multiplier.
- **Retrigger:** every scatter landing in a free spin adds THAT MANY spins
  (1 sc → +1, 2 sc → +2 …), so the multiplier can climb past 128×. Hard-capped
  at 18 spins in the round (`freeSpinsCap` 18 = `custom.stickyRoundCap` 18).
  The manifest's `retriggerSpins: 1` is the Vice-style field and is not read on
  the plant path (`mockHost.ts:567-577`).
- **Hard session cap:** the round STOPS the moment the running total reaches
  `maxWinMultiplier` × bet (5000× in the default version), payout locked at the
  cap, MAX WIN marquee takes over. Settlement, display and simulator all stop
  on the same spin.

**Base game — PLANT FEATURE (~1 in 170).** Not free spins, and easy to miss:
it is worth 6.6% of the RTP on its own.

- Fires on a base spin when `hash32(stops, 0x5eed) % custom.baseFeatureOdds`
  (170) is 0, and only when that spin did not already land 3+ scatters and the
  round was not bought (`mockHost.ts:316`).
- 1..5 plants (same `plantCountWeights`), each drawing its own multiplier from
  `custom.baseFeatureMultipliers`
  `[[2,620],[4,240],[8,90],[16,32],[32,11],[64,4],[128,2],[256,1]]`.
- The spin is RE-EVALUATED with those plants standing as full-reel wilds and
  the result **replaces** the plain result — it does not stack on top. Same
  highest-crossed-plant rule, scatter unmultiplied.
- Derived from the STOPS, not carried in the settled state, so no new
  game-state field and no decode fork.

### Certified (Crack Farm v2)

`src/data/math_crack_farm.json`: `targetRtpPct` **96.0**, `rtpBps` **9600**,
`simResults` `{rtp_pct: 96.0, k: 0.2755, method: "stratified"}`,
`maxWinMultiplier` 5000, `minWager` 10000.

Straight play-through sampling cannot sign this model off — free spins trigger
1 in 399 and a round averages hundreds of ×, so six 300k-spin runs disagreed by
16 RTP points. It is certified **stratified** (base / feature / per-tier rounds
measured separately and recombined), 3 seeds, and the paytable is a single
scale `k` over the base table.

The 3-seed stratified run at k=0.2774 (`custom-math/cert_5000.txt`):

| | |
|---|---|
| RTP | 96.68% (seeds 96.1 / 96.6 / 97.3, spread 1.19 pts) |
| base game | 4.74% |
| plant feature | 6.56% — 1 in 170, avg 11.2× |
| free spins | 84.82% |
| FS trigger | 1 in 399 |
| 3 sc | 1 in 412, avg 309.3×, max 5000× |
| 4 sc | 1 in 12,000, avg 1164.4×, max 5000× |
| 5 sc | 1 in 1,800,000, avg 1935.4×, max 5000× |

RTP is near-linear in k, so the shipped manifest carries k trimmed to
**0.2755** (0.2774 × 96.0/96.68) to centre the 3-seed mean on 96.0%.
The 10 000× and 15 000× versions certify the same way at k 0.2426 / 0.2327
(`cert_10000.txt`: 96.44%; `cert_15000.txt`: 96.26% before the same trim).

Reproduce: `python custom-math/simulate_crack_farm_v2.py 1 5000`
(arg 1 = sample scale, arg 2 = max win ×; env `CF_TARGET_RTP` default 96,
`CF_FS_SPINS` default 7). Re-emit the three manifests with
`python custom-math/emit_crack_farm_math.py` — it reads the simulator's own
constants so the shipped config and the RTP proof cannot drift.

---

### HISTORY — retired v1 plant math (do NOT build)

Kept so nobody re-derives it from an old branch or from
`custom-math/simulate_crack_farm.py`. **Every line in this block is dead.**

- ~~3 scatters = ROAMING PLANT (one wild-capable reel fully wild per spin).~~
  Retired: 3 scatters now play the same plant round as 4 and 5, just starting
  at 1×. The roaming branch survives in `mockHost.ts` only as the fallback for
  a bought round.
- ~~4 scatters = sticky plant towers, cap 3, leftmost first, with ONE SHARED
  multiplier starting at 1× and growing +`plantMultiIncrement` (1) per
  tower-crossing connection, capped at `plantMultiCap` 20.~~ Retired: each
  plant now carries its own multiplier, doubling per spin, cap 1024. Building
  the shared +1 ladder against the v2 paytable underpays the bonus by roughly
  an order of magnitude.
- ~~Round lengths 3sc = 8, 4sc = `stickyRoundSpins` 6, caps 11, retrigger +3.~~
  Retired: 7 spins for every tier, cap 18, retrigger +1 per scatter landed.
- ~~Certified 6M spins, k=1.3916, RTP 95.9% / alt-seed 95.6%, hit 44.6%,
  fs3 1-in-41 avg 6.1×, fs4 1-in-451 avg 248×.~~ VOID — those numbers measure
  the shared-multiplier model against a v1 paytable that is no longer shipped
  (the actual re-cert log `custom-math/_cf_recert.log` reads 95.56%). The
  v1 reproduce command `simulate_crack_farm.py 1200000 6000000` with
  `CF_STICKY_SPINS=6 CF_TARGET_RTP=93.5` reproduces the retired model only.
