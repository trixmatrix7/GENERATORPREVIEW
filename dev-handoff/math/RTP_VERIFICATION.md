# Vice Heat — RTP verification (for the dev)

> # ✅ CURRENT CERTIFICATION — 2026-07-27 (use `sim_vice.mjs`, not the Python)
>
> The Python model describes the DESIGN. `sim_vice.mjs` in this folder mirrors the actual
> settlement code, and re-measuring against it is what exposed four live defects (a ways
> evaluator that under-paid whenever a wild sat in column 0, a retired multiplier ladder still
> being paid, a hot-spin feature that was advertised but never built, and buy strips that had
> been overwritten). Everything below is the fixed, shipped game:
>
> | mode | cost | certified RTP | rounds |
> |---|---|---|---|
> | natural | 1× | **95.91%** ±1.14pp | 30,000,000 |
> | buy 3-scatter | 100× | **95.93%** ±1.04pp | 1,500,000 |
> | buy 4-scatter | 200× | **96.11%** ±1.20pp | 1,500,000 |
> | ante | 3.25× | **96.40%** ±1.35pp | 12,000,000 |
>
> Zero max-win-cap violations across ~45M rounds. `rtpBps` 9591. Natural attribution
> (% of wager): base 52.98 · hot 6.56 · fs3 9.82 · fs4 26.55. Hit frequency 70.43%,
> per-round std 24.32× of stake, max win 1-in-109,091.
>
> Reproduce: `node sim_vice.mjs 30000000 --mode=natural --eval=corrected --no-simul --hot --seed=880022`
> (swap `--mode=` for buy3 / buy4 / ante). `fit_fs_density.mjs` is the tool that tuned the
> top-level `fsReelStrips` density onto target. **Never run without `--eval=corrected --no-simul --hot`
> — the defaults deliberately model the OLD broken runtime so the difference stays measurable.**
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
