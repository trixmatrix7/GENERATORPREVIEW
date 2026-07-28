# Vice Heat — RTP verification (for the dev)

> # ✅ CURRENT CERTIFICATION — 2026-07-28 (`custom-math/sim_vice_core.mjs`)
>
> **⛔ The 2026-07-27 table that used to sit here (95.91 / 95.93 / 96.11 / 96.40) is VOID.**
> It was measured with `--eval=corrected`, an evaluator we wrote on the belief that a wild in
> column 0 folding to `HIGH_A` was a bug. It is not — `SlotGame.sol:341` does exactly that, and
> **the contract is the spec**. The "corrected" evaluator made every symbol connect with every
> other symbol on a wild reel. It has been deleted; every number it produced is void, and the
> `--eval=corrected` flag on `sim_vice.mjs` must not be used for certification.
>
> The certifying tool is now **`custom-math/sim_vice_core.mjs`**, which drives the *live* round
> core (`src/game/viceSpin.ts`) — the same pure function our settlement and our display both
> call, so what it measures is literally what the game pays.
>
> | mode | cost | certified RTP | rounds | confirmed by |
> |---|---|---|---|---|
> | natural | 1× | **96.46%** ±1.59pp | 20,000,000 | 96.94% ±2.95pp / 6M, separate seed |
> | buy 3-scatter | 100× | **96.20%** ±0.49pp | 2,000,000 | — |
> | buy 4-scatter | 200× | **95.97%** ±0.56pp | 2,000,000 | independent simulator; core harness 96.34% ±1.12pp / 500k, fresh seed |
> | ante | 3.25× | **96.00%** ±1.16pp | 20,000,000 | 3sc 1-in-20.5 · 4+sc 1-in-172.4 · hot 1-in-80.1 |
>
> Zero max-win-cap violations in every run, and zero invariant violations (credited-sum = totalWin,
> totalWin ≤ cap, no negative credits, deterministic re-derivation). `rtpBps` **9670**.
>
> Natural attribution (% of wager): base 47.88 · hot 3.76 · fs3 14.16 · fs4 30.66. Hit frequency
> 68.24%, per-round std 28.01× of stake.
> Ante attribution: base 24.70 · hot 6.84 · fs3 14.48 · fs4 49.98. Hit frequency 74.93%, per-round
> std 20.22× of stake, max win 1-in-11,581.
> 4-scatter buy: max win 1-in-143 (1-in-135 on the fresh-seed cross-check), tower guarantee fires
> on 83.6% of rounds, zero-tower rounds 0% (was 15.5%), mean 2.03 towers at round end.
>
> **⚠️ Size the run off the per-round spread, not off habit.** The ante's per-round std is ~20× of
> stake, so 4M rounds only buy a ±2.54pp interval — our own 4M pass read **94.3%**, which was noise
> and was never published. 20M gets to ±1.16pp and lands on 96.00%. Note also that the harness runs
> buy modes at `rounds/4` (a bought round replays a whole bonus): ask for 2M and you measure 500k.
>
> **What restored the RTP was a mechanic, not an evaluator change:** per-reel **tower
> multipliers ×1–×5** on fully-wild free-spin reels, weights `[55,20,9,6,10]`, a combination
> paying × the **HIGHEST** badge it crosses (a product model measured 187% on the 4-scatter buy;
> a sum model floored at 90.53%). Badges are drawn from a reserved seed namespace so the
> reel-stop stream is untouched — that is what lets two independent simulators agree.
>
> Reproduce: `node custom-math/sim_vice_core.mjs 20000000 --mode=natural --seed=4242424`
> (swap `--mode=` for buy3 / buy4 / ante). The machine-readable record lives in
> `math_vice_heat.json → simResults` and is copied into the preset.
>
> ---
>
> **⚠️ Superseded 2026-07-27 (earlier pass, kept for history) — `simulate_vice_heat_v2.py`:**
> The FS math was redesigned: **5 full wild reels = instant 5000× max win** in
> both bonuses (`custom.fullBoardInstantMaxWin`), the FS rolls its own
> **rare-wild `fsReelStrips`** (5×120-stop, 1 wild/reel), sticky tower cap **5**,
> and the old sticky ×2/×10 simul + full-house ×2 doubling is **retired**.
> That pass produced the paytable we still ship (`payTable.wild [1243,2034,3616]`,
> `scatterPay [1164,2260,6780]`) — but **its RTP figure is void**: it certified
> **95.99% / rtpBps 9599** on a free-spins model that had no tower multipliers, and
> that model measures a **71.6% floor** against the shipped game. `vice_heat_expanding.json`
> in this folder has since been **re-emitted** and now reads **`rtpBps` 9670**,
> `custom.towerMultiplier*`, `stickyTowerCap 5` — it matches
> `preset/vice-heat.chainwtf-preset.json → math.manifest`. If you see 95.99 / 9599
> anywhere, it is stale.
> Reproduce the *historical* pass with `VH_STICKY_CAP=5 VH_FS_STRIP_LEN=120 VH_STICKY_SPINS=10 VH_FS_SPINS=7 VH_K=1.13 python simulate_vice_heat_v2.py`
> — it will not reproduce the shipped RTP, only the retired model. Its max-win
> mechanism breakdown (4sc **0.74%**, 3sc **~1-in-333k/bonus**, both via the
> 5-full-board route) came from `sims/vice_maxwin_analysis.py`; the shipped
> frequencies are in the table above (4sc buy max win 1-in-143, ante 1-in-11,581).
> The v1 numbers below are the previous certification, kept for history.

The certification method is Monte-Carlo (the tiered/sticky/tower rules are not
closed-form). The **current** reference model is `sim_vice_core.mjs` in this
folder — it bundles the live round core `features/round-core/viceSpin.ts` and
measures it directly. `vice_heat_expanding.json` is the emitted, certified
manifest the runtime consumes (`rtpBps` 9670) and is identical to
`preset/vice-heat.chainwtf-preset.json → math.manifest`.

---

# ⛔ HISTORY BELOW — THE RETIRED v1 MODEL. DO NOT BUILD FROM IT.

**Everything from here to "END OF HISTORY" describes the pre-tower-multiplier v1
model (`simulate_vice_heat.py`). It is kept so nobody re-derives it from scratch.
Every RTP number in it is VOID and at least three of its mechanics do not exist in
the preset.** If you implement this section you ship a different game: no tower
badges (free spins pay a **71.6% floor** instead of the certified 96.46%), a
multiplier ladder the settlement never applies, a tower cap two short, and a pay
floor a third below the shipped one.

| the v1 section says | the shipped game (preset `math.manifest`) |
|---|---|
| RTP 95.99% / rtpBps 9599 | **96.46%** natural, `rtpBps` **9670** — see the table at the top |
| pay floor 768 bps = 0.077× | **1164 bps = 0.1164×** (`payTable` lowE…lowG, `scatterPay[0]`) |
| `simulExpandMultipliers {"3":2,"4":10}` | **key does not exist.** 1–4 wild reels pay natural ways |
| `stickyTowerCap` 3 | `custom.stickyTowerCap` **5** (both `viceBuyStages` carry 5) |
| full-house / `stickyFullBoardMultiplier` ×2 | field is present and set to **1 = OFF** |
| RTP split 29.6 / 4.2 / 32.5 / 30.0 | base **47.88** · hot **3.76** · fs3 **14.16** · fs4 **30.66** |
| 3sc 1-in-67 · 4sc 1-in-921 | not the certified figures. Certified: FS trigger 1-in-**63.3** natural vs 1-in-**18.31** on the ante (`custom.anteBet.naturalTriggerIn` / `anteTriggerIn`); ante 3sc 1-in-**20.5**, 4+sc 1-in-**172.4**; hot spins 1-in-**80.1** |
| (no such mechanic) | **tower multipliers ×1–×5**, weights `[55,20,9,6,10]`, HIGHEST crossed badge |
| (no such mechanic) | **guaranteed tower** on the 4-scatter buy (`guaranteedTowerOnFirstSpin`) |

## TL;DR numbers (HISTORY — v1, VOID)

| Metric | Value |
|---|---|
| **RTP** | ⛔ **VOID** — 12M-spin cert **95.99%**, 4-seed 20M-spin mean 96.5% ±0.6 (SEM), alt-seed 1M 93.3%. Shipped: **96.46%**, `rtpBps` 9670 |
| Pay scalar `k` | **0.7452** (v1 fit; the shipped paytable is not derived from it — read `payTable` verbatim) |
| Hit frequency | **69.3%** (v1) — shipped: **68.24%** natural, 74.93% ante |
| Volatility (per-spin σ) | ~29× bet (v1) — shipped per-**round** std **28.01×** natural, 20.22× ante |
| Max win | **5000× bet** — still current (`maxWinMultiplier`), see the CURRENT section below for the two routes |
| Pay floor | ⛔ **VOID** — 768 bps = 0.077× bet. Shipped floor is **1164 bps = 0.1164× bet** |
| Ways | 3125 (5×5, all symbols pay from 3-of-a-kind) — still current |

RTP split (v1 contribution to its own ~96%): base **29.6** · hot **4.2** · fs3 **32.5** · fs4 **30.0**.
⛔ Not the shipped attribution — that is base 47.88 · hot 3.76 · fs3 14.16 · fs4 30.66 (% of wager).

> **(HISTORY) Why 96% and not the original 93.4%?** The free-spins rounds were length­ened
> (3 SC 5→**7** spins, 4 SC 5→**10** sticky spins). More spins = more player EV.
> Holding the old 0.10× pay floor while adding those spins would force RTP over
> 100%, so the floor was lowered to 0.077× (still shows $0.02 on 20¢) and the
> RTP settles at the tightest house-positive point that keeps the floor. See
> the design note in `MATH_MODEL.md`.

## Free-spins tiers (HISTORY — v1, VOID)

⛔ **This is the retired tier model.** The shipped tiers are: 3 scatters = 7 spins with
per-spin expansion, 4 scatters = 10 STICKY spins to `stickyTowerCap` **5**, retrigger **+3**,
`freeSpinsCap` 10 / `stickyRoundCap` 13, `freeSpinMultiplier` 1, and **tower multipliers ×1–×5**
on every fully-wild reel. There is no simul ladder and no full-house ×2.

- **3 scatters — 1-in-67 — 7 spins.** Per-spin expanding wilds + the
  simul-expansion ladder (`simulExpandMultipliers {"3":2,"4":10}`). The 4-reel
  ×10 alignment is the **only route to the 5000× cap** (~**0.028%** of 3sc
  rounds, round max seen 8390× before the cap). Avg round **21.8×**.
- **4 scatters — 1-in-921 — 10 STICKY spins.** Expanded reels stay fully wild
  for the round; towers accumulate up to `stickyTowerCap` **3**. This is the
  **high-average** tier: avg round **276×**, but capped ~**1371×** (does not
  reach 5000×). `stickyFullBoardMultiplier` is **1** (the old FULL HOUSE ×2 is
  retired — at 10 spins it compounded RTP past 105%).
- Retrigger +3 spins, per-tier caps 10 / 13 (at most one retrigger). *(still current)*
- Hot spin: 1-in-80 base spins play per-spin expansion incl. the ladder.
  ⛔ The **1-in-80 hot spin is live** (`custom.hotSpinChance1In` 80) but there is **no ladder**:
  a hot spin pays its natural ways win with **no multiplier and no tower badge**
  (`towerMultiplierOnHotSpins: false`), and it never fires on a bought round.

## Reproduce it (HISTORY — v1 tooling)

⛔ These commands reproduce the **retired** model, not the shipped RTP. For the
current certification use `node custom-math/sim_vice_core.mjs 20000000 --mode=natural --seed=4242424`
(see the banner at the top of this file).

Requirements: Python 3 (stdlib only — no numpy). From the repo root of the
math package:

```bash
# v1 definitive run: 1.5M-spin tuning fit + 12M-spin certification + 1M alt-seed.
python simulate_vice_heat.py 1500000 12000000
```

Expected (seed-99 cert; ±MC noise): `rtp_pct ≈ 95–98`, `hit_freq_pct ≈ 69.3`,
`fs3_ge_maxwin_pct ≈ 0.03`, `fs4_ge_maxwin_pct ≈ 0`. The script prints the
TUNING RUN (k=1), the fitted `scale k`, the CERTIFICATION RUN, and an ALT-SEED
sanity RTP, then writes `vice_heat_expanding.json`.

**Robust RTP (recommended check):** the single-seed cert is noisy because the
3sc ×10 spike is a fat tail. Fix the paytable and average several seeds:

```bash
for s in 99 202 303 404; do
  VH_K=0.7452 VH_CERT_SEED=$s python simulate_vice_heat.py 100 5000000
done
# mean of the four rtp_pct ≈ 96.5% (±0.6 SEM) over 20M spins
```

### Simulator env knobs (HISTORY — v1 simulator; these defaults do NOT reproduce the shipped manifest)

| Env | Default | Meaning |
|---|---|---|
| `VH_FS_SPINS` / `VH_FS_CAP` | 7 / 10 | 3-scatter round length / cap |
| `VH_STICKY_SPINS` / `VH_STICKY_ROUND_CAP` | 10 / 13 | 4-scatter sticky round length / cap |
| `VH_STICKY_CAP` | 3 | max sticky towers — ⛔ shipped value is **5** |
| `VH_STICKY_FULL_MULT` | 1 | full-house multiplier (1 = off — still off in the shipped preset) |
| `VH_SIMUL3` / `VH_SIMUL4` | 2 / 10 | simul-expansion ladder — ⛔ **retired, not in the preset** |
| `VH_TARGET_RTP` | 93.5 | fit target for `k` (realized lands ~96 due to MC/cap) |
| `VH_CERT_SEED` | 99 | cert RNG seed |
| `VH_K` | — | skip tuning, use a fixed `k` |
| `VH_ROWS` | 5 | 5 = 5×5, 3 = 5×3 |

# ✅ END OF HISTORY — everything below is CURRENT

## Contract rules the dev must implement

Read every parameter out of `preset.math.manifest` — do not hard-code, and do not
carry anything over from the history section above. (Flat copies of the same fields
also exist at the preset root as a documented fallback, not as a second source of
truth.) Reference implementation: `features/round-core/viceSpin.ts`, the exact file
`sim_vice_core.mjs` bundles and certifies. Settlement is deterministic from the spin
seed; the only additional draw is the tower badge, taken from a **reserved seed
namespace** `keccak(seed, 1n << 200n)` so the reel-stop stream is bit-identical
whether the mechanic is on or off.

`math.manifest.custom` — the live parameters:

| key | value | note |
|---|---|---|
| `stickyTowerCap` | **5** | both `viceBuyStages[]` carry 5 as well |
| `stickyRoundSpins` / `stickyRoundCap` | 10 / 13 | 4-scatter sticky round |
| `freeSpinsCount` / `freeSpinsCap` | 7 / 10 | 3-scatter round (manifest root) |
| `retriggerSpins` | **3** | not +7 |
| `freeSpinMultiplier` | 1 | deliberate — value comes from expansion + towers |
| `towerMultiplierWeights` | `[55,20,9,6,10]` | badge ×1–×5 per fully-wild FS reel |
| `towerMultiplierRule` | HIGHEST crossed badge | not the product (187% on buy4), not the sum (90.53% floor); scatter pay is never multiplied |
| `towerMultiplierStickyRule` | badge frozen on join (4sc) | 3sc redraws every spin |
| `towerMultiplierOnHotSpins` | **false** | hot spins carry no badge |
| `fullBoardInstantMaxWin` | **true** | 5 fully wild reels pay exactly `maxWinMultiplier × bet` instantly and end the round, in BOTH bonuses, nothing multiplied on top |
| `hotSpinChance1In` / `hotSpinExpandsWilds` | 80 / true | natural + ante BASE spins only; never on a bought round; may suppress a scatter trigger (certified behaviour) |
| `stickyFullBoardMultiplier` | **1 = OFF** | field kept for schema compatibility — do **not** implement a full-house ×2 |
| `viceBuyStages[]` | `costMult` 100 (3sc) / 200 (4sc) | each ships its own `fsReelStrips`; stage 2 also `guaranteedTowerOnFirstSpin` + `guaranteedTowerReel: 0` |
| `anteBet.costMult` | 3.25 | ships its own base `reelStrips` |
| ~~`simulExpandMultipliers`~~ | **absent from the preset** | do not implement a simul ladder — 1–4 wild reels pay natural ways |

**Max win has exactly two routes:** (a) the full board above, and (b) the
running-total cap at `maxWinMultiplier × wager`. Nothing else reaches 5000×. Note
that route (a) is reachable in the **base game** too: if all five reels go hot on the
same spin, that is a full board and it pays the instant max win.

**Guaranteed tower (4-scatter buy only).** If the first free spin of a bought stage-2
round would land no tower, reel 0 slides forward onto a wild
(`guaranteedTowerOnFirstSpin`, `guaranteedTowerReel: 0`). Reel 0 because the engine
folds a column-0 wild to `HIGH_A`, which makes that tower ~10× cheaper in RTP than any
other reel. Measured: fires on **83.6%** of rounds, zero-tower rounds **0%** (were
**15.5%**, i.e. 1 in 6.4 bought rounds showed no tower at all), mean **2.03** towers at
round end. Price is unchanged at 200× — the strips were re-fitted around the guarantee.
Bought rounds only; never on a natural or ante trigger.

**Strips.** The base `reelStrips` are 5×40. The shared free-spins `fsReelStrips` are
5×1170 (rare wilds); a bought round rolls **its stage's** strips instead — 5×1215
(stage 1) or 5×2406 (stage 2). Ship those arrays **verbatim**: at that wild density
the arrangement is a first-order lever (the same stage-2 multiset measured 95.88% in
one shuffle and 99.21% in another). Whatever strips the settlement evaluates, the
DISPLAY must roll the same ones, and the reel-length config must be swapped with them
— they are not 40 stops.

`maxWinMultiplier` (5000) and `minWager` (10000) are the unchanged template
invariants. The pay floor — **1164 bps = 0.1164× bet**, also `scatterPay[0]` — and the
anti-clustered strips are baked into `payTable` / `scatterPay` / `reelStrips`, so no
extra logic is needed for either.

**Rounds of record are the table at the top of this file** (natural 20M, buy3 500k,
buy4 4M independent + 500k core cross-check, ante 20M). Ignore
`viceBuyStages[].certifiedRounds: 8000000` in the preset — no run of that size exists.
