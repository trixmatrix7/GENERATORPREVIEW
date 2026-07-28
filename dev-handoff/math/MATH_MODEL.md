# Vice Heat — custom math model (for dev review)

> # ✅ CURRENT MODEL — 2026-07-28 (`custom-math/sim_vice_core.mjs`)
>
> **⛔ Everything in the "HISTORY" section at the bottom of this file is VOID.** Until this
> revision, this document taught two mechanics that **do not exist in the shipped preset** and a
> tower cap that makes the game's only jackpot route unreachable. If you built from the old rules
> you built a different game. Concretely, what changed:
>
> | the old text said | the shipped truth | what happens if you build the old text |
> |---|---|---|
> | implement `custom.simulExpandMultipliers` `{"3":2,"4":10}` (contract rule 5) | **the key does not exist in the preset.** 1–4 wild reels pay plain natural ways | you invent a ×10 spike the preset never pays; RTP and the max-win route are both wrong |
> | implement the FULL HOUSE `stickyFullBoardMultiplier` doubling (contract rule 7) | the field is present and set to **1 = OFF**. It is a dormant slot, not a feature | you double every full-board spin and blow past the certified RTP |
> | `stickyTowerCap` **3** | **5** — in `custom.stickyTowerCap` *and* in **both** `viceBuyStages` | at cap 3 the 5-tower FULL BOARD can never form, and the **sole route to the 5000× max win disappears** |
> | pay floor **768 bps / 0.077×** | **1164 bps = 0.1164×** (`payTable` minimum and `scatterPay[0]`) | every low win pays ~34% short |
> | 3sc simul-×10 is the max-win route | **FULL BOARD (5 wild reels) = instant max win**, in BOTH bonuses | you ship a game that cannot reach its advertised 5000× |
> | (absent) | **TOWER MULTIPLIERS ×1–×5** — the mechanic that carries the free-spins RTP | free spins pay a **71.6% floor** against the certified 96.46% |
> | (absent) | **GUARANTEED TOWER** on the 4-scatter buy | 15.5% of bought rounds (1 in 6.4) show no tower at all on a buy sold as tower spins |
>
> Any RTP, hit-rate or round-average figure ever measured against the old rules is void — including
> **95.99 / 95.91 / 95.93 / 96.11 / 96.40 / 95.52 / 94.3**, the `k = 0.7452` pay scalar, and the
> `--eval=corrected` evaluator. The certifying tool is now `custom-math/sim_vice_core.mjs`, which
> drives the **live** round core (`src/game/viceSpin.ts`) — the same pure function settlement and
> display both call, so what it measures is literally what the game pays.
>
> **The "D11" ways-evaluator fix is RETRACTED.** A column-0 wild folding to `HIGH_A` is the SPEC —
> `SlotGame.sol:341` does exactly that. **Do not change `WinEvaluator.ts` or `SlotGame.sol`.**

> **Für Noski:** ~96%-Modell auf 5×5, TIERED Bonus mit LÄNGEREN Runden
> (3 SC = **7** Spins, 4+ SC = **10** Sticky-Spins), **Turm-Multiplikatoren ×1–×5**,
> Hot-Spins, harter 5000×-Cap. 20M-Sim-zertifiziert auf dem LIVE-Rundenkern.
> Die alte Simul-Mult-Leiter und der Full-House-×2 sind **raus**. Dieses Paket geht so an den Dev.

## The model (5×5 · 3125 ways · RTP 96.46%)

- **DISPLAY PAY FLOOR:** the smallest connection (single-way 3-oak lowG) pays
  **1164 bps = 0.1164× bet** → **$0.02 on a $0.20 spin** at 2 decimals. This is the
  `payTable` minimum, and `scatterPay[0]` sits on the same floor
  (`scatterPay [1164, 2260, 6780]`).
- **Per-way curve is FLAT-ish:** with 3125 ways the TOP comes from **ways mass ×
  expansion × tower multiplier**, not per-way steepness.
- **ANTI-CLUSTERED strips (verified against the shipped `reelStrips`):** 40 stops per reel.
  midC/lowE/lowG heavy on reels 1/3/5, thin on 2/4; highB/midD/lowF inverted — 3-in-a-row
  chains break at the thin reel → hit rate **68.24%**.
  Wilds: **1 per strip on ALL FIVE reels** (reel 1 is *not* clean — it carries a wild, and it
  has to, because the 5-tower full board is the max-win route). Scatters: 1 per strip.
  Wild art is a money-stack "W"; wild pays as highA (`payTable.wild` == `payTable.highA`).
- **TIERED FREE SPINS:**
  - **3 scatters (1-in-68): 7 spins**, per-spin expanding wilds. Every fully wild reel is dealt
    a **fresh ×1–×5 tower badge each spin** (the board re-expands from scratch). 1–4 wild reels
    pay natural ways × the highest badge crossed.
  - **4+ scatters (1-in-879): 10 spins**, STICKY expanding wilds up to
    **5 towers** (`stickyTowerCap` **5**). A sticky tower **keeps the badge it was dealt when it
    JOINED** for the rest of the round. This tier reaches the 5000× cap — via the FULL BOARD.
  - The old FULL-HOUSE ×2 is **retired** (`stickyFullBoardMultiplier` **1** = off). The field
    stays in the contract as a dormant slot; **do not implement the doubling**.
  - Retrigger: **+3 spins** (custom rule, not a re-award of `freeSpinsCount`), per-tier caps
    10 / 13 — at most one retrigger.
  - Fully wild reels contribute no scatters.
- **HOT SPIN:** 1-in-80 natural or ante BASE spins expand every reel whose window holds a wild.
  The spin pays its **natural ways win with no multiplier** — hot spins carry **no tower badge**
  (`custom.towerMultiplierOnHotSpins: false`). **Never on a bought round.** A hot spin can
  suppress a scatter trigger (certified behaviour, not a bug). All 5 reels hot +
  `fullBoardInstantMaxWin` = an instant max win **in the base game**.
- Session cap 5000×, min wager 10000 — template invariants unchanged. `rtpBps` **9670**.

## TOWER MULTIPLIERS ×1–×5 — the mechanic that carries the free spins

Every reel standing **fully wild during a free spin** is dealt a badge ×1–×5 from
`custom.towerMultiplierWeights` **[55, 20, 9, 6, 10]** (so 55% of towers are a plain ×1).

A winning combination pays × the **HIGHEST badge among the expanded reels it CROSSES** — a ways
combination starts on reel 0 and runs `matchCount` reels, so it crosses reels `0 … matchCount-1`.

**HIGHEST, not the product — this was measured, not chosen:**

| model | 4-scatter buy RTP |
|---|---|
| product of all crossed badges | **187%** — multiplicative in tower count, unshippable |
| sum of crossed badges | floors at **90.53%** even with the weights pushed down |
| **highest crossed badge** | lands on target and stays there across all four modes |

- Scatter pay is **never** multiplied.
- Nothing is applied on top of the 5-wild **instant max win** (it is already the cap).
- Hot spins get **no** badge (base-game feature; this mechanic is free-spins only).
- **⚠️ Draw the badges from a RESERVED seed namespace** — ours is `keccak(seed, 1 << 200)` — so
  the reel-stop stream is untouched and the reels land identically whether the mechanic is on or
  off. If you draw badges inline from the round's stream, every stop after the first badge shifts
  and **every RTP figure in the preset becomes meaningless for your build**.
- Art: `theme/vice/wild_multi_sheet.webp`, a 5-frame strip (×1…×5). See
  `features/tower-multipliers/` for the full spec and the reference implementation
  (`src/game/viceSpin.ts` → `drawTowerMultiplier()` / `applyTowerMultipliers()`).

**Omit this and the free spins pay a 71.6% floor against the certified 96.46%.**

## MAX WIN — exactly two routes

1. **FULL BOARD (the real one):** 5 fully wild reels pay **exactly `maxWinMultiplier` × bet
   INSTANTLY** and end the round — `custom.fullBoardInstantMaxWin`, in **BOTH** bonuses, with
   **nothing multiplied on top**. This is why `stickyTowerCap` must be **5**.
2. **The running-total cap** at `maxWinMultiplier` × wager.

There is no third route. In particular there is **no** simul-×10 spike — that mechanic is gone.

## GUARANTEED TOWER on the 4-scatter buy

`custom.viceBuyStages[].guaranteedTowerOnFirstSpin` (stage 2 only, `guaranteedTowerReel` **0**):
if the first free spin would land with **no** fully-wild reel, reel 0 is advanced to the next stop
whose window holds a wild.

- Reel **0** specifically, because the engine folds a column-0 wild to `HIGH_A`, which makes that
  tower ~10× cheaper than any other.
- Without it **15.5% of bought rounds (1 in 6.4)** showed no tower at all — on a buy sold as
  "10 sticky tower spins". Now **0%**; the guarantee fires on **83.6%** of rounds; mean **2.03**
  towers at round end.
- **Bought rounds ONLY** — never a natural or an ante trigger.
- Priced in: the buy **stays 200×**.

## The numbers (certified — `custom-math/sim_vice_core.mjs`, the live round core)

| mode | cost | certified RTP | rounds | confirmed by |
|---|---|---|---|---|
| natural | 1× | **96.46%** ±1.59pp | 20,000,000 | 96.94% ±2.95pp / 6M, separate seed |
| buy 3-scatter | 100× | **96.20%** ±0.49pp | 2,000,000 | — |
| buy 4-scatter | 200× | **95.97%** ±0.56pp | 2,000,000 | independent simulator; core harness 96.34% ±1.12pp / 500k, fresh seed |
| ante | 3.25× | **96.00%** ±1.16pp | 20,000,000 | 3sc 1-in-20.5 · 4+sc 1-in-172.4 · hot 1-in-80.1 |

Zero max-win-cap violations and zero invariant violations in every run. `rtpBps` **9670**.

| Metric | Value |
|---|---|
| Hit frequency | **68.24%** (natural) · 74.93% (ante) |
| Volatility | per-round std **28.01×** of stake (natural) · 20.22× (ante) |
| RTP attribution, natural (% of wager) | base **47.88** · hot **3.76** · fs3 **14.16** · fs4 **30.66** |
| RTP attribution, ante (% of wager) | base **24.70** · hot **6.84** · fs3 **14.48** · fs4 **49.98** |
| Max win | **5000× bet** — full board instant, or the running-total cap |
| Max win rate | 4sc buy **1-in-143** (1-in-135 fresh seed) · ante 1-in-11,581 |
| Pay floor | **1164 bps = 0.1164× bet** → $0.02 on a $0.20 spin |
| Ways | 3125 (5×5, all symbols pay from 3-of-a-kind) |

**Trigger + round shape** (400k-round spot-check on the live core, seed 4242424 — trigger rates are
high-frequency and well converged; the round *averages* are fat-tailed and indicative only):
3sc **1-in-68.1**, 4+sc **1-in-879.1**, hot **1-in-77.5**.
3sc round avg **10.1×** (p50 3.2× · p90 20.3×); 4sc round avg **~277×** (p50 32.7× · p90 606×),
and it **does** reach the cap — biggest 4sc round seen 4999.8×.

> **⚠️ Size any re-run off the per-round spread, not off habit.** At a per-round std of ~20–28× of
> stake, 4M rounds only buy a ±2.5pp interval — our own 4M ante pass read **94.3%**, which was
> noise and was never published. Do not re-fit anything under ~20M rounds.

## Strips — ship them VERBATIM

- The FS rolls its **own rare-wild `fsReelStrips`** (5 × 1170 stops, 10 wilds per reel); a
  **BOUGHT** round rolls **its stage's** strips (buy3: 1215 stops; buy4: 2406 stops, 24/16/16/16/15
  wilds + 18 scatters per reel).
- **The DISPLAY must roll whatever the SETTLEMENT evaluates, and `reelLengths` must be swapped
  along with the strips.** Swap one without the other and the round shows wins on the wrong cells.
- At these wild densities the **arrangement** is a first-order lever, not just the counts: the same
  buy4 multiset measured **95.88%** in one shuffle and **99.21%** in another. They cannot be
  regenerated — copy the stop arrays exactly.
- Buys read verbatim from `costMult`: 3-scatter **100×**, 4-scatter **200×**. Ante **3.25×**.

## Files

- `vice_heat_expanding.json` — the manifest, standard shape + `custom` block. The live keys are
  `stickyTowerCap: 5`, `retriggerSpins: 3`, `stickyRoundSpins: 10`, `stickyRoundCap: 13`,
  `stickyFullBoardMultiplier: 1` (OFF), `hotSpinChance1In: 80`, `fullBoardInstantMaxWin: true`,
  `towerMultiplierWeights: [55,20,9,6,10]`, `towerMultiplierOnHotSpins: false`, `viceBuyStages`,
  `anteBet`. **There is no `simulExpandMultipliers` key.**
- `sim_vice_core.mjs` — **the certifying tool.** Bundles and drives the live TS round core, so it
  measures what the game pays. `node custom-math/sim_vice_core.mjs 20000000 --mode=natural`
  (swap `--mode=` for `buy3` / `buy4` / `ante` / `all`). Note it runs buy modes at `rounds/4`.
- `sim_vice.mjs` — the independent re-implementation. The two must agree, or the extraction changed
  the math. **Never certify with `--eval=corrected`** (see the retraction in the banner).
- `simulate_vice_heat.py` / `simulate_vice_heat_v2.py` — **HISTORY ONLY.** These predate the tower
  multipliers and model the retired ladder; they cannot describe the shipped game.

## What the dev needs to add (contract side)

**NINE** settlement rules beyond the current template (was "seven" before 2026-07-28 — rules 5 and
7 of the old list were deleted, and four new ones added). All are deterministic from the spin
randomness; the only reserved-namespace draw is the tower badge in rule 5.

1. **FS expansion:** in FS resolution, reels containing ≥1 wild evaluate with
   count = ROWS for every symbol (full-wild reel). Full-wild reels contribute
   no scatters.
2. **Sticky tier:** when the TRIGGER board had ≥4 scatters, keep a sticky set
   across the round's spins: every wild-carrying reel joins it (up to
   `stickyTowerCap` **5**, leftmost joins first) and evaluates full-wild for every
   remaining spin. No per-spin expansion for non-sticky reels in sticky rounds — once the cap
   is reached, later wilds **stay regular 1:1 wilds** (`viceSpin.ts` ~L449-455).
3. **Per-tier round length:** 3sc rounds start with `freeSpinsCount` (**7**),
   sticky rounds with `stickyRoundSpins` (**10**); total caps `freeSpinsCap` (**10**)
   / `stickyRoundCap` (**13**).
4. **Retrigger:** award `retriggerSpins` (**3**) instead of re-awarding
   `freeSpinsCount`, bounded by the tier's cap.
5. **TOWER MULTIPLIERS ×1–×5:** every reel standing fully wild **in a free spin** is dealt a badge
   from `towerMultiplierWeights` **[55,20,9,6,10]**. A combination pays × the **HIGHEST** badge
   among the reels it crosses (reels `0 … matchCount-1`) — **not** the product, **not** the sum.
   Scatter pay is never multiplied. Sticky towers keep the badge they JOINED with; 3sc towers
   redraw every spin. **Draw from a reserved seed namespace** (`keccak(seed, 1<<200)`) so the
   reel-stop stream is untouched.
6. **FULL BOARD = INSTANT MAX WIN:** 5 fully wild reels pay exactly `maxWinMultiplier` × bet
   immediately and end the round (`custom.fullBoardInstantMaxWin`), in **BOTH** bonuses, with
   nothing — no tower badge, no anything — applied on top.
7. **Hot spin:** derive a 1-in-`hotSpinChance1In` (**80**) flag from the existing spin seed; when
   set, expand every reel whose window holds a wild on a **base** spin. Pays natural ways, **no
   badge, no multiplier**. **Never on a bought round.** May suppress a scatter trigger — that is
   certified behaviour. 5 hot reels + rule 6 = an instant max win in the base game.
8. **Guaranteed tower (4-scatter BUY only):** with
   `viceBuyStages[].guaranteedTowerOnFirstSpin`, if the first free spin would land no fully-wild
   reel, advance `guaranteedTowerReel` (**0**) to the next stop whose window holds a wild.
   Bought rounds only — never natural, never ante.
9. **Strip swap:** a bought round evaluates its **stage's** `fsReelStrips`; a natural/ante FS
   evaluates the top-level `fsReelStrips`. Swap `reelLengths` together with the strips, and make
   the DISPLAY roll whatever the SETTLEMENT evaluates.

**Two fields are deliberately inert — do NOT implement them as features:**
`stickyFullBoardMultiplier` is **1** (the retired FULL HOUSE ×2; the field stays only so it could
be re-enabled if round length were ever shortened), and any `simulExpandMultipliers` binding you
find in the features registry is a **stale reference to a key that no longer exists** in `custom`.

Everything else (strips, paytable, ways evaluation, caps) is the unchanged
template pipeline — including the column-0-wild→`HIGH_A` fold, which is the spec.

---

# HISTORY — ⛔ VOID, kept only so nobody re-derives it

> **Everything below describes the pre-2026-07-28 model. It is NOT the shipped game.**
> It is retained because these numbers circulated, and a reader who finds them elsewhere needs to
> be able to identify them as dead. Do not implement, do not measure against, do not quote.

**The retired mechanics.** The model below was built on a **simul-expansion ladder**
(`simulExpandMultipliers {"3": 2, "4": 10}` — *n* reels expanding in the SAME spin multiplied that
spin's win) and, before that, a **FULL HOUSE ×2** doubling while the sticky set held every tower.
Neither exists in the shipped preset: the ladder key was deleted outright, and the full-house
multiplier is pinned to 1. The tower cap in this old model was **3** (earlier 4), not 5.

**The retired max-win story.** The old text claimed the 3sc 4-reel simul-×10 alignment was "the
only route that reaches the 5000× cap (~0.028% of 3sc rounds, round max 8390× before the cap)",
and that the 4sc tier "does not reach the cap" (avg 276×, capped ~1371×). Both statements are dead.
The max win is now the **FULL BOARD**, reachable in both tiers, and the 4sc tier does hit 5000×.

**The retired design note** — *"why 4sc no longer hits the 5000× cap"* — argued that doubling the
round to 10 spins made the full board form almost every round, so the ×2 compounded RTP past 105%,
and that taming it (cap 3 towers, ×2 off) moved the jackpot to the 3sc simul-×10 spike. The
conclusion was superseded by the tower-multiplier rebuild: the full board is now the jackpot
*by design*, and the RTP is carried by the ×1–×5 badges instead of a ladder.

**The void numbers.** Every figure from this model is void:
RTP **95.99%** (12M "cert") · **95.91 / 95.93 / 96.11 / 96.40** (the `--eval=corrected` table) ·
**95.52** (pre-tower ante) · **94.3** (a 4M ante run that was pure noise) · **71.8** (the broken
evaluator) · 4-seed 20M mean "96.5% ±0.6" · alt-seed 1M "93.3%" · hit frequency **69.3%** ·
pay floor **768 bps / 0.077×** and scatter floor **768/1490/4471** · pay scalar **k = 0.7452** ·
RTP split base 29.6 / hot 4.2 / fs3 32.5 / fs4 30.0 · 3sc round avg 21.8× · trigger rates
1-in-67 and 1-in-921. `targetRtpPct 95.99` is likewise void — the preset carries
`targetRtpPct: 96` as **display metadata only**; `rtpBps` **9670** is the operative figure.

**The retired simulator knobs.** `simulate_vice_heat.py`'s `VH_SIMUL3` / `VH_SIMUL4` (ladder),
`VH_STICKY_FULL_MULT` (full house) and `VH_STICKY_CAP` default **3** drove the numbers above.
The script has no tower-multiplier model at all, so no invocation of it can reproduce the shipped
game. Certify with `custom-math/sim_vice_core.mjs` only.
