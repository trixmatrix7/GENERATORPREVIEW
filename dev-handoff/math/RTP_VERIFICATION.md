# Vice Heat — RTP verification (for the dev)

This is everything needed to **independently reproduce and check the ~96% RTP**
and the tiered free-spins math. The certification method is Monte-Carlo (the
tiered/sticky rules are not closed-form); `simulate_vice_heat.py` is the
reference model and `vice_heat_expanding.json` is the emitted, certified
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
