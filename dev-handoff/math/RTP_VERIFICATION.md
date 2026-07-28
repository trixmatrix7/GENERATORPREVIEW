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
> | buy 3-scatter | 100× | **96.35%** ±0.97pp | 500,000 | — |
> | buy 4-scatter | 200× | **96.08%** ±0.39pp | 4,000,000 | independent simulator; core harness 96.34% ±1.12pp / 500k, fresh seed |
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
> Reproduce: `node custom-math/sim_vice_core.mjs 20000000 --mode=natural --seed=90210`
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
> `vice_heat_expanding.json` in this folder is the re-synced manifest
> (`payTable.wild [1243,2034,3616]`, `scatterPay [1164,2260,6780]`, rtpBps 9599).
> Reproduce with `VH_STICKY_CAP=5 VH_FS_STRIP_LEN=120 VH_STICKY_SPINS=10 VH_FS_SPINS=7 VH_K=1.13 python simulate_vice_heat_v2.py`.
> Certified: RTP **95.99%**, 4sc max-win **0.74%** (only at 4–5 standing towers),
> 3sc max-win **~1-in-333k/bonus** (100% via 5-full-board) — reproduce the
> mechanism breakdown with `sims/vice_maxwin_analysis.py`. The v1 numbers below
> are the previous certification, kept for history.

This is everything needed to **independently reproduce and check the ~96% RTP**
and the tiered free-spins math. The certification method is Monte-Carlo (the
tiered/sticky rules are not closed-form); `simulate_vice_heat_v2.py` is the
current reference model and `vice_heat_expanding.json` is the emitted, certified
manifest that the runtime consumes.

## TL;DR numbers (certified)

| Metric | Value |
|---|---|
| **RTP** | **~96%** — 12M-spin cert **95.99%**, 4-seed 20M-spin mean **96.5% ±0.6 (SEM)**, alt-seed 1M **93.3%** |
| Pay scalar `k` | **0.7452** (single linear scale fitted to the target, then re-simulated) |
| Hit frequency | **69.3%** |
| Volatility (per-spin σ) | ~29× bet |
| Max win | **5000× bet** (hard session cap — round stops, MAX WIN marquee) |
| Pay floor | **768 bps = 0.077× bet** → **$0.02 on a $0.20 spin** at 2 decimals |
| Ways | 3125 (5×5, all symbols pay from 3-of-a-kind) |

RTP split (contribution to the ~96%): base **29.6** · hot **4.2** · fs3 **32.5** · fs4 **30.0**.

> **Why 96% and not the original 93.4%?** The free-spins rounds were length­ened
> (3 SC 5→**7** spins, 4 SC 5→**10** sticky spins). More spins = more player EV.
> Holding the old 0.10× pay floor while adding those spins would force RTP over
> 100%, so the floor was lowered to 0.077× (still shows $0.02 on 20¢) and the
> RTP settles at the tightest house-positive point that keeps the floor. See
> the design note in `MATH_MODEL.md`.

## Free-spins tiers (what produces the numbers)

- **3 scatters — 1-in-67 — 7 spins.** Per-spin expanding wilds + the
  simul-expansion ladder (`simulExpandMultipliers {"3":2,"4":10}`). The 4-reel
  ×10 alignment is the **only route to the 5000× cap** (~**0.028%** of 3sc
  rounds, round max seen 8390× before the cap). Avg round **21.8×**.
- **4 scatters — 1-in-921 — 10 STICKY spins.** Expanded reels stay fully wild
  for the round; towers accumulate up to `stickyTowerCap` **3**. This is the
  **high-average** tier: avg round **276×**, but capped ~**1371×** (does not
  reach 5000×). `stickyFullBoardMultiplier` is **1** (the old FULL HOUSE ×2 is
  retired — at 10 spins it compounded RTP past 105%).
- Retrigger +3 spins, per-tier caps 10 / 13 (at most one retrigger).
- Hot spin: 1-in-80 base spins play per-spin expansion incl. the ladder.

## Reproduce it

Requirements: Python 3 (stdlib only — no numpy). From the repo root of the
math package:

```bash
# Definitive run: 1.5M-spin tuning fit + 12M-spin certification + 1M alt-seed.
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

### Simulator env knobs (all optional; defaults reproduce the shipped manifest)

| Env | Default | Meaning |
|---|---|---|
| `VH_FS_SPINS` / `VH_FS_CAP` | 7 / 10 | 3-scatter round length / cap |
| `VH_STICKY_SPINS` / `VH_STICKY_ROUND_CAP` | 10 / 13 | 4-scatter sticky round length / cap |
| `VH_STICKY_CAP` | 3 | max sticky towers |
| `VH_STICKY_FULL_MULT` | 1 | full-house multiplier (1 = off) |
| `VH_SIMUL3` / `VH_SIMUL4` | 2 / 10 | simul-expansion ladder |
| `VH_TARGET_RTP` | 93.5 | fit target for `k` (realized lands ~96 due to MC/cap) |
| `VH_CERT_SEED` | 99 | cert RNG seed |
| `VH_K` | — | skip tuning, use a fixed `k` |
| `VH_ROWS` | 5 | 5 = 5×5, 3 = 5×3 |

## Contract rules the dev must implement

The seven deterministic settlement rules (no new RNG — all derived from the
existing spin seed) are specified in **`MATH_MODEL.md` → "What the dev needs to
add"**. The manifest `custom` block carries every parameter
(`stickyTowerCap`, `stickyRoundSpins`, `stickyRoundCap`, `retriggerSpins`,
`simulExpandMultipliers`, `stickyFullBoardMultiplier`, `hotSpinChance1In`).
`maxWinMultiplier` (5000) and `minWager` (10000) are the unchanged template
invariants. The pay floor and anti-clustered strips are baked into the
paytable/`reelStrips` in the manifest — no extra logic.
