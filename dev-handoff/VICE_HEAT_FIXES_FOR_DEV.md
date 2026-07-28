# Vice Heat — Engine Fixes Required (Dev-Facing Spec)

**Status:** Launch-blocking. Target launch: **Thursday.**
**Preset under discussion:** `dev-handoff/preset/vice-heat.chainwtf-preset.json` (schema `chainwtf-game-preset` v2).

> ## ✅ FINAL CERTIFICATION — 2026-07-28 (this supersedes every RTP number anywhere below, **including the 95.91 / 95.93 / 96.11 / 96.40 table this block used to carry**)
>
> ### ⚠️ Read D11 first if you saw the previous revision of this document.
> The earlier certification was measured against an evaluator we had "corrected" on the belief that `SlotGame.sol:341` was buggy. **It is not** — the contract is the spec, our design-model simulator was the outlier, and the corrected evaluator made every symbol connect with every other symbol on a wild reel. That evaluator is deleted and **those four RTP numbers are void.** D11 is retracted in full; no engine or contract change is wanted.
>
> These numbers are measured against the **contract's** rule set, by `custom-math/sim_vice_core.mjs`, which drives the *live* round core (`src/game/viceSpin.ts` — the same function our settlement and our display both call). A second, independently written simulator confirms the two headline rows.
>
> | mode | cost | certified RTP | rounds | confirmed by |
> |---|---|---|---|---|
> | **natural** | 1× | **96.46%** ±1.59pp | 20,000,000 | 96.94% ±2.95pp / 6M, separate seed |
> | **buy 3-scatter** | 100× | **96.20%** ±0.49pp | 2,000,000 | — |
> | **buy 4-scatter** | 200× | **95.97%** ±0.56pp | 2,000,000 | independent simulator; core harness 96.34% ±1.12pp / 500k on a fresh seed |
> | **ante** | 3.25× | **96.00%** ±1.16pp | 20,000,000 | trigger promise held: 3sc 1-in-20.5, 4+sc 1-in-172.4, hot 1-in-80.1 |
>
> **Zero max-win-cap violations in every run**, and zero violations of the round invariants (credited-sum = totalWin, totalWin ≤ cap, no negative credits, re-derivation deterministic). `rtpBps` is **9670**.
>
> ⚠️ **Round counts are not interchangeable across modes** — pick them off the per-round spread, not off habit. The ante carries a per-round std of ~20× stake, so a 4M run gives a ±2.54pp interval: our own 4M pass read 94.3% and that number was pure noise. 20M narrows it to ±1.16pp and lands on 96.00%. If you re-measure the ante, do not conclude anything from a few million rounds.
>
> Natural RTP attribution (share of wager): **base 47.9% · hot spins 3.8% · FS 3-scatter 14.2% · FS 4-scatter 30.7%.**
>
> **What moved since the previous drop, and why it matters to you:**
> - **The evaluator is untouched again.** See D11. Anything you measured or changed on the strength of the old D11 should be reverted.
> - **NEW MECHANIC — per-reel TOWER MULTIPLIERS ×1–×5 (D12).** This is where the free-spins RTP was restored. Every fully-wild reel in a free spin is dealt a badge from `custom.towerMultiplierWeights` `[55,20,9,6,10]`; a combination pays × the **HIGHEST** badge it crosses. Not a product, not a sum. Badges are drawn from a **reserved seed namespace** so the reel-stop stream is untouched.
> - **NEW — GUARANTEED TOWER on the 4-scatter buy (D13).** 15.5% of bought rounds used to show no tower at all; now 0%. Priced in — the buy is still 200×.
> - **`custom.simulExpandMultipliers` stays deleted.** 1–4 wilds pay natural ways; only 5 full wild reels pay the instant max win. **Do not implement a simul ladder.**
> - **Hot spins are real** (`custom.hotSpinChance1In` 80). They fire on natural and ante base spins and **never on a bought round** (expansion would erase the scatters the player paid for). ⚠️ The **ante depends on them**.
> - **The buy stages carry their own strips.** buy3 a 405-stop / 15-wild FS set, buy4 its own calibrated set with the tower guarantee. **Prices unchanged at 100× and 200×.** ⚠️ When you swap strips you must swap **`reelLengths` with them** — we shipped a round where they desynced and the display rolled a different board than the settlement scored.
> - Top-level `fsReelStrips` are **1170 stops with 10 wilds**; buy3/buy4 carry their own.
>
> **Reproduce a row — use ITS seed, not one shared seed.** Each row was measured on its own seed and
> its own round count; running a different seed measures a different sample and will not land on the
> published figure. Every row's seed and round count is in `math.manifest.simResults`.
>
> ```
> node custom-math/sim_vice_core.mjs 20000000 --mode=natural --seed=4242424
> node custom-math/sim_vice_core.mjs 20000000 --mode=ante    --seed=771177
> node custom-math/sim_vice_core.mjs  8000000 --mode=buy3    --seed=90210    # buys run rounds/4
> node custom-math/sim_vice_core.mjs  8000000 --mode=buy4    --seed=90210
> ```
> The full machine-readable record — per-mode RTP, CI, attribution, tower-count distribution, guarantee fire rate, max-win frequency, invariant violations — is `math.manifest.simResults` in the preset.

> **UPDATE 2026-07-27 — FREE-SPINS RE-CERTIFICATION (supersedes the D2 numbers and the §E scatterPay below):**
> The FS math was redesigned to Noski's volatile spec and re-certified at RTP **95.99%** (`custom-math/simulate_vice_heat_v2.py`, k=1.13). The preset now carries — at `math.manifest` **and** the flat export root:
> - **Rare-wild FS strips `fsReelStrips`** (5×**120**-stop, ONE wild/reel = **3× rarer** than the 40-stop base). **The free spins MUST roll these strips, NOT the base strips.** Now surfaced at both `math.manifest.fsReelStrips` and the export root (belt-and-braces, same as the D8 math-root flatten).
> - **`custom.fullBoardInstantMaxWin: true`** — 5 fully-wild reels pay exactly `maxWinMultiplier × bet` **INSTANTLY** and end the round (the 5000× MAX WIN marquee), in **both** bonuses. 1–4 wilds pay natural ways. Reference impl: `src/dev/mockHost.ts` (`fullReels >= reelsN && fullBoardInstantMaxWin → rawFsWin = maxWin`); mirrors `simulate_vice_heat_v2.py` (`len(full) >= REELS → MAX_WIN`).
> - **3sc = per-spin expansion** (7 spins; wilds expand for that spin only). **4sc = STICKY** towers accumulate to **`custom.stickyTowerCap: 5`** (10 spins). The old sticky `stickyFullBoardMultiplier` / `simulExpandMultipliers` doubling stays **OFF** — max win is the 5-tower / 5-simul jackpot, not a per-spin ×N.
> - **New paytable** `payTable.wild [1243, 2034, 3616]`; **`scatterPay [1164, 2260, 6780]`** (⚠️ the `[768,1490,4471]` in §E is STALE — use the preset value). `freeSpinsCount 7`, `custom.stickyRoundSpins 10` unchanged.
> - **Certified distribution:** 4sc max-win **0.74%**, and ONLY ever with **4 or 5 standing towers** (never fewer); 3sc max-win **~1-in-333k per bonus** (100% via the 5-full-board instant). All three surfaces agree (mockHost settlement + our display + the simulator).
> - Preset mechanic `sticky-expanding-towers` now binds `custom.stickyTowerCap`, `custom.fullBoardInstantMaxWin`, `fsReelStrips`.
>
> **⚠️ THE RULE WE NOW WATCH FOR — THE FS DISPLAY MUST ROLL THE SAME STRIPS THE SETTLEMENT EVALUATES.** This re-cert first shipped half-wired: settlement swapped to `fsReelStrips` but the DISPLAY kept rolling the **base** strips → wilds appeared on screen yet "didn't connect with Q/J", because the shown board ≠ the settled board. **Rule: whatever strips the settlement evaluates during free spins, the display reels MUST roll the same** (our fix: `PixiApp.setupFsSwapStrips` + `ensureClusterReels('fs')`, with a base restore on FS-exit and spin-start). This is the ways-game twin of the general "presentation math must mirror settlement math" invariant — verify **per FS spin** that a displayed expanded wild actually forms the ways it should. Applies to your engine too: if you roll base strips for the FS visuals but settle on `fsReelStrips`, you reproduce this exact bug.

> **UPDATE 2026-07-26 — final pass on our side (nothing else changed vs the last drop):**
> - **Audio finalized.** Noski's real mix is baked (`src/data/viceSoundPreset.json`) and re-exported into the preset: 12 flat events at his exact levels (ambient-music 0.35, win-screen-music 0.95, connect-symbol/coin-chime 0.53, spin-start 0.47, reel-stop 0.16, scatter-land 0.55, free-spin-trigger 0.59). The old reconstruction mix is gone. **Your runtime does not dispatch `fs-retrigger`, `tease-riser`, `tease-miss`, `wild-land`, `wild-expand` — those are in his mix but silent in your build until you fire them** (see §Audio).
> - **Buy-card prices fixed our side** (€ currency, value centred inside the grey pill, auto-scaled so it never overflows).
> - **Sizing/layout final** (grid centred, left-letterbox logo, bonus button under it) — see §Sizing; the `machineBox` block is authoritative.
> - **This preset carries ONLY the current Vice state** — no stale sounds, tease, mechanics, or old math. Verified against the repo.

**Reference implementation for ALL math:** the live round core **`src/game/viceSpin.ts`**, shipped verbatim in this package as **`dev-handoff/features/round-core/viceSpin.ts`** — pure, seed-deterministic, reads the exact `custom{}` keys the preset ships, and is the function `sim_vice_core.mjs` certified. **Port from there.** `src/dev/mockHost.ts` is our multi-game settlement harness — for Vice it **delegates to `deriveViceRound()`** (`:236`, `:727`); the older in-file FS blocks below that are the other games' path and still carry retired Vice branches (see D2), so they are not a reference for this build.

---

## 0. Executive summary — read this first

Vice Heat was built and certified in our preview studio (`C:/Users/noski/Downloads/GENERATOR PREVIEW/src`). We export a preset JSON; your generator (`devgen/slots_game-main`, live on CloudFront) compiles it. **Your ingestion channel is math-only + theme colors/asset art.** It silently drops (a) our preset's entire `math.manifest.custom{}` block and (b) our entire presentation config (`flow`, `assets`, `extras.presentationTuning`, our `mechanics[]`). All rich presentation — marquee, win-lines, FS counters, intro, control bar — is drawn **hardcoded / from fixed registries / procedurally** in your engine, so it overrides ours.

**The single most important number: half the certified RTP lives in `custom{}`.** Vice's certified **96.46%** (natural) is produced by a free-spins engine that **expands wilds into full-reel walls**, deals every fully-wild reel a **TOWER MULTIPLIER ×1–×5** (D12), stacks those towers **sticky to a cap of 5** on a 4-scatter trigger, and pays an **instant 5000× on a full board** — plus hot spins, two staged buys and an ante. All of that lives in `math.manifest.custom{}`, which every dev-side consumer drops. Our `simResults` (`preset.math.manifest.simResults.natural.attributionPctOfWager`, preset lines 20122-20127) attribute the natural RTP as **base 47.9 · hot spins 3.8 · FS-3sc 14.2 · FS-4sc 30.7** points of wager — i.e. **48.6 of the 96.46 points come from `custom{}` mechanics your build does not have.** Your build keeps only the base ways + an unmultiplied (`freeSpinMultiplier=1`) plain FS on the base strips → **live RTP lands near half of target.** That is the "math majorly wrong," and it is why the base game "feels dead": the base ways alone are 47.9 points, the game was designed to live in the bonus. Scale check: keep everything and drop **only** the tower multipliers and the whole game still floors at **71.6%** — this gap is not a rounding error.

> ⛔ **Two mechanics an earlier revision of this summary listed here are RETIRED — do not build them.** `custom.simulExpandMultipliers` (the simultaneous-expansion ladder) is **deleted from the preset**, and the full-house `stickyFullBoardMultiplier` is present but set to **`1` = OFF**. See D2. The "95.99% / base ≈29.6 · hot ≈4.2 · FS-3sc ≈32.5 · FS-4sc ≈30.0" split this paragraph used to carry was measured against the retracted evaluator (D11) and is **void**; the certification block at the top of this document is the only live table.

**VERIFY D8 FIRST.** Before implementing anything, confirm which object you passed into `buildGameConfigFromMathProfile` / `configFromMathProfile`. Our math is nested under `preset.math.manifest`; your loaders read those keys at the **profile root**. If you fed `preset` or `preset.math` instead of `preset.math.manifest`, `reelStrips` is `undefined` and the game **silently falls back to the Fantasy 5×3 default** — which alone would explain "fundamentally wrong." This is a five-minute check that could be the whole story.

**Symbol identity is NOT a bug.** Both engines agree WILD=0 / SCATTER=1; your win-eval never lets a wild pay as a scatter, nor lets scatters form ways (byte-identical to ours). See D6 for what "scatters connect through the wilds" actually is.

---

# SECTION A — MATH / MECHANICS (highest priority)

All "our spec" lines are `src/data/math_vice_heat.json` unless noted; the same values appear in the preset under `math.manifest` / `math.manifest.custom`. All "reference impl" lines are the live round core `src/game/viceSpin.ts` (= `dev-handoff/features/round-core/viceSpin.ts`) unless a settlement/host seam is meant, in which case `src/dev/mockHost.ts` is cited explicitly. All "dev gap" lines are under `devgen/slots_game-main/`.

| ID | Mechanic | Severity | Owner |
|----|----------|----------|-------|
| ~~D11~~ | ~~Ways evaluator: wild on reel 0 collapses the paytable to HIGH_A~~ | ❌ **RETRACTED — was our error, change nothing** | — |
| **D12** | **Tower multipliers ×1–×5 on fully-wild reels (NEW)** | **Launch-blocking (carries the FS RTP)** | DEV |
| **D13** | **Guaranteed tower on the 4-scatter buy (NEW)** | High (the buy's promise) | DEV |
| D8 | Ingestion object (nested vs flat root) | **VERIFY FIRST** | Coordinate |
| D1 | Expanding wilds in FS | Launch-blocking | DEV |
| D2 | Sticky expanding towers (cap **5**) + full-board instant max win | Launch-blocking | DEV |
| D3 | Staged bonus buys (3sc@100×, 4sc@200×) | Launch-blocking (if buys ship) | DEV |
| D4 | Ante bet (3× FS chance, 3.25× cost) | Launch-blocking (if ante ships) | DEV |
| D5 | `freeSpinMultiplier=1` model mismatch | Design note | DEV (do NOT bump) |
| D6 | "Scatters through wilds" = missing expansion | Not a win-eval bug | DEV (= D1) |
| D7 | Hot-spins base feature (~4% RTP) | Correctness/feel | DEV |
| D9 | Phantom Hold&Win baked into contract | Cleanup | DEV |
| D10 | rtpBps overwritten to 9600 at compile | Cosmetic | US or DEV |

## D8 — INGESTION RISK (verify before anything else)
- **Symptom:** potential total breakage — wrong grid/strips/pays, or silent fallback to Fantasy 5×3.
- **Root cause:** our export nests the math under `preset.math.manifest` (`vice-heat.chainwtf-preset.json:27-32`; values at `math.manifest.reelStrips/payTable/scatterPay/gridId/…`). Every dev loader expects those keys at the **profile root**:
  - `src/ui/generator/buildGameConfig.ts:40-43` returns `null` (→ Fantasy default, `GameConfig.ts:126-137`) if `reelStrips` is missing.
  - `src/generator/validator/simulator.ts:487-491` — same.
  - `src/generator/agents/assembler.ts:32,66-76` — same.
- **What is already CORRECT once the right object is passed:** payTable key→id map (`buildGameConfig.ts:12-23`, `simulator.ts:475-485`) handles `wild/highA/…`; grid resolves from `gridId:'5x5'` (`assembler.ts:71`, `buildGameConfig.ts:82-87`, `simulator.ts:505-512`) → 5 rows; per-way bps and total-wager scatter bps units match exactly (no cents/coins/% mismatch); base reel strips are uniform length 40.
- **Who fixes:** COORDINATE. **DEV:** confirm you passed `preset.math.manifest` (not `preset` or `preset.math`). **US:** we will also emit the manifest fields at the object root as a belt-and-braces fix (see our-side doc).

## D1 — Expanding wilds in free spins (not implemented dev-side)
- **Symptom:** "math majorly wrong"; FS pays a fraction of spec; base game feels dead.
- **Our spec:** `math_vice_heat.json:272` `"expandingWildsInFreeSpins": true`. **Reference impl:** `src/game/viceSpin.ts:447-462` (= `features/round-core/viceSpin.ts`) — before ways eval, every wild-carrying reel is overwritten to full wild (`makeFullWild`, i.e. `board[row][reel] = 0`); the `else` branch `:457-461` is the per-spin (3-scatter) case, the `if` branch above it the sticky one (D2). Config mapping: `src/config/mathProfiles.ts:60` (`custom.expandingWildsInFreeSpins → config.expandingWildsInFS`). ⚠️ Ignore the old `src/dev/mockHost.ts:458-478` pointer that used to sit here — those lines are now **Crack Farm's roaming-plant** code, not Vice expansion.
- **Dev gap (no expansion anywhere):**
  - Contract `contract/src/SlotGame.sol:227-246` — FS loop just re-evaluates the raw board × flat `FREE_SPIN_MULTIPLIER`.
  - Dev harness `src/dev/mockHost.ts:140-158` — `fsWin = rawFsWin * freeSpinsMultiplier`.
  - Validator sim `src/generator/validator/simulator.ts:256-277` — same.
  - `GameConfig` interface (`src/engine/GameConfig.ts:77-99`) has no expanding-wild field; `contractRenderer.ts:16-43` and `assembler.ts:15-56` never read `custom`.
- **Who fixes:** DEV. No preset key can enable this; the mechanic must be built.
- **Concrete fix:** In the FS loop, before `_evaluateWins`, port `features/round-core/viceSpin.ts:447-462`: for each reel where any visible cell == 0, set the whole reel column to 0 (WILD). Gate on a new config flag read from `custom.expandingWildsInFreeSpins`. Expand on a **copy** of the board (`evalBoard`) — the landed board is what the display animates from.

## D2 — Sticky expanding towers (cap 5) + full-board instant max win (not implemented)
- **Symptom:** "mechanics fundamentally wrong, many things missing"; the entire 4-scatter max-win route is absent; volatility and top-end wrong.
- **Our spec** (`preset.math.manifest.custom`, scalars at preset lines 299-309; mirrored in `src/data/math_vice_heat.json`): `expandingWildsInFreeSpins:true`, `stickyExpandingFrom4Scatters:true`, **`stickyTowerCap: 5`** (`:302`), `stickyRoundSpins:10`, `stickyRoundCap:13`, `retriggerSpins:3`, **`fullBoardInstantMaxWin: true`** (`:20095`, flat root `:46145`), `stickyFullBoardMultiplier: 1` (`:306`). **Both** `viceBuyStages` carry `stickyTowerCap: 5` as well, so a bought round uses the same cap.
- **The shipped model in one paragraph.** A **3-scatter** round expands per spin (7 spins; wilds expand for that spin only, then clear). A **4-scatter** round is **STICKY**: wild-landing reels become permanent full-wild towers, leftmost joins first, **up to 5**; later wilds play as ordinary 1:1 wilds. Every standing tower carries a **×1–×5 badge (D12)** and a combination pays × the **highest** badge it crosses. **5 towers standing = the whole board is wild = instantly `maxWinMultiplier × bet`, round over** (`fullBoardInstantMaxWin`) — that, plus the running-total cap, is the entire max-win route. There is no per-spin ×N ladder anywhere in it. Retrigger adds **+3** spins (not +7); `stickyRoundCap 13` bounds the round.
- ⛔ **Do NOT build a simul ladder and do NOT build a full-house doubling.** `custom.simulExpandMultipliers` **does not exist in `math.manifest.custom`** — the only mention left in the preset is the note in `simResults.ruleSet` recording that it is retired. (An earlier export also carried a dangling `mathBinding` entry for it on the `expanding-wild` mechanic; that binding has been removed, and `custom-math/verify_preset_parity.mjs` now fails the export if any `mathBinding` names a key the manifest does not have.) `stickyFullBoardMultiplier` is **`1` = OFF** (preset `:306`, flat root `:26356`). If you implement either, you are building a model we retired *and* invalidating the certification — the multiplicative route measured **187% RTP** on the 4-scatter buy, which is why it was cut.
  > **HISTORY — do not re-derive.** An earlier drop of this document specified `stickyTowerCap: 3` (4 on the bought stage), `simulExpandMultipliers {3:2, 4:10}` and `stickyFullBoardMultiplier: 2` while all towers stood, with the max win coming out of that doubling. That whole model is retired; it was replaced by tower multipliers (D12) + the full-board instant max win, and every RTP figure measured against it is void.
- **Reference impl:** `src/game/viceSpin.ts:405-520` — the live round core, shipped verbatim in this package as **`dev-handoff/features/round-core/viceSpin.ts`** (same line numbers): sticky join loop `:447-462` (cap check `:452`), badge deal `:464-479` (D12), full-board instant max win `:481-489`, retrigger `:515-518`. ⚠️ **Do not port the FS blocks out of `src/dev/mockHost.ts`.** For Vice that harness delegates to `deriveViceRound()` (`:236`, `:727`); the in-file FS loop that follows is the other games' path and still carries the retired `simulExpandMultipliers` / full-house branches with stale comments (`:547-563`, "cap 3", "×2 while all 4 towers stand"). They are inert only because the Vice config keys are gone or `1` — porting them reintroduces the retired model.
- **Dev gap:** none of `stickyTowerCap`, `stickyRoundSpins/Cap`, `retriggerSpins`, `fullBoardInstantMaxWin`, `towerMultiplierWeights` exist in any dev file (grep across `devgen/.../src` = zero engine/settlement hits). Bonus registry `src/registries/bonusMechanics.ts:9-48` offers only `free-spins-multiplier`, `bonus-buy`, `hold-and-win`.
- **Who fixes:** DEV.
- **Concrete fix:** Port the FS block of `features/round-core/viceSpin.ts` (`:405-520`) reading the same `custom` keys. D12 (badges) and D13 (guaranteed tower) plug into that same loop — build them together, or the free spins land at the 71.6% floor.

## D3 — Staged bonus buys (buy-3sc @100×, buy-4sc @200×) (not implemented)
- **Symptom:** buy feature missing or paying the wrong round.
- **Our spec:** `custom.viceBuyStages[]` — stage1 = 3sc / `costMult 100`, stage2 = 4sc / `costMult 200`. Each stage carries its own certified `fsReelStrips` (+ `fsStripsRule`: ship the stop arrays **verbatim**, the arrangement is a first-order lever) and `stickyTowerCap: 5`; stage2 additionally carries `guaranteedTowerOnFirstSpin` + `guaranteedTowerReel` (D13). **No stage carries `simulExpandMultipliers` or `stickyFullBoardMultiplier`** — those keys are retired (D2). In the preset: `math.manifest.custom.viceBuyStages` opens at `:310`, stage1 `costMult 100` at `:314`, stage2 `costMult 200` at `:6413`, `guaranteedTowerOnFirstSpin` at `:18462`. **Reference impl:** `src/game/viceSpin.ts` (`buyStage` overrides: strips `:414-415`, spins/cap `:416-420`, tower cap `:408`, guarantee `:437-442`).
- **Dev gap:** only a single scalar `bonusBuyCost` / `BONUS_BUY_COST_X100` (`SlotGame.sol:28,209-224`; `buildGameConfig.ts:71-73`; `bonusMechanics.ts:24-35`). No concept of multiple stages, per-stage strips, or per-stage multiplier overrides. `assembler.ts:25-29` wires only a single buy cost, and only if the `bonus-buy` flag is set.
- **Who fixes:** DEV (multi-stage buy) — or descope to a single buy for launch.
- **Concrete fix:** Implement a staged-buy path keyed on `gameData = abi.encode(uint8 stage)` reading `custom.viceBuyStages` — host seam `src/dev/mockHost.ts:236-244` (stage decode) + `:718-730` (`settleVice`: the COST is the wager, the round plays at the base bet `wager / costMult`, then `deriveViceRound(randomness, bet, config, stage)`). Round rules: `features/round-core/viceSpin.ts`.

## D4 — Ante bet ("3× FS chance", 3.25× cost) (not implemented)
- **Symptom:** ante toggle missing / no strip swap.
- **Our spec:** `custom.anteBet{ costMult: 3.25, reelStrips[] }` — preset block opens at `:18467`, label `"3x FREE SPINS CHANCE"`, `costMult 3.25` at `:18469`, **`certifiedRtpPct 96.00`** (20,000,000 rounds, ±1.16pp — see the certification block at the top). The ante rolls its own base strips (8× symbol mix, 320 stops, raised wild density) and **still rolls the shared top-level `fsReelStrips` in the bonus**; ⚠️ its value depends on **hot spins** (D7) — ante attribution is base 24.7 · hot 6.8 · FS-3sc 14.5 · FS-4sc 50.0 points of wager, so an ante shipped without hot spins is under-priced. **Reference impl:** `src/game/viceSpin.ts:355-361` (`stageCode 3` → swap to `config.anteBet.reelStrips` for that base spin only; `stageCode` 0 = natural, 1 = bought 3sc, 2 = bought 4sc, 3 = ante — `:138-139, 343-355`); host seam `src/dev/mockHost.ts:236-244` (stage decode) + `:721-726` (ante price → base bet: `wager × 100 / round(costMult × 100)`).
- **Dev gap:** no `anteBet` anywhere; no strip-swap mechanism in `SlotGame.sol` / dev `mockHost.ts` (single fixed `REEL_STRIPS`).
- **Who fixes:** DEV.
- **Concrete fix:** Add an ante code path (stage 3) that swaps to `custom.anteBet.reelStrips` for that base spin only — the free spins keep rolling the shared `fsReelStrips` — per `features/round-core/viceSpin.ts:355-361`.

## D5 — `freeSpinMultiplier = 1` is meaningless without expansion (model mismatch)
- **Symptom:** even the FS that DOES run pays almost nothing.
- **Root cause:** our design carries FS value through **wild expansion**, so `freeSpinMultiplier` is deliberately `1` (`math_vice_heat.json:268`). Your model carries FS value through a flat multiplier; your registry expects `freeSpinMultiplier ∈ [2,10]` (`bonusMechanics.ts:19`). `assembler.ts:48` stamps our `1` into the contract → dev FS ≈ one plain ways spin × 7, ×1.
- **Who fixes:** DEV (implement D1–D2). **Do NOT "rescue" RTP by bumping the flat multiplier** — our value comes from board transforms, not a scalar; bumping it will not reproduce our distribution.

## D6 — "Scatters connect through the wilds" = the missing expansion, NOT a win-eval bug
- **The win-eval is clean.** In your engine the wild does not substitute for scatter and scatters do not form ways:
  - Scatter counted only by exact id: `WinEvaluator.ts:74` / `SlotGame.sol:328` (`== SYM_SCATTER`).
  - Scatter skipped as a ways seed: `WinEvaluator.ts:117` / `SlotGame.sol:340`.
  - Ways count is `cell === effectiveSym || cell === WILD` only (`WinEvaluator.ts:138` / `SlotGame.sol:351`); wild→HIGH_A (`:120` / `:341`). This is byte-identical to our own `src/game/winEval.ts` → `src/engine/WinEvaluator.ts`. **No literal scatter-substitution bug exists.**
- **What the owner is actually seeing:** in the certified game, FS wild reels expand into solid wild walls that **overwrite the scatters sitting on those reels** ("Fully wild reels contribute no scatters" — `math_vice_heat.json:285` note). Because the dev build never expands (D1), scatters stay interleaved with the lone wilds on reels 1-4, wins thread past them, and those persistent scatters keep re-triggering FS far more often than intended. That reads on screen as "scatters connecting through the wilds." **Fix = D1** (expansion overwrites the scatters), not a change to the evaluator.
- **Secondary — retrigger AMOUNT is also wrong:** dev adds a full `FREE_SPINS_COUNT` (7) per retrigger (`SlotGame.sol:243` `remaining += FREE_SPINS_COUNT`); our spec is `retriggerSpins: 3` (`math_vice_heat.json:267` top level, `:275` inside `custom`), which the dev engine has no field for. **Fix:** DEV reads `custom.retriggerSpins` (`features/round-core/viceSpin.ts:420` reads it, `:515` applies it — `+3`, and the round still stops at `stickyRoundCap 13`).

## D7 — "Hot spins" base-game feature (1-in-80 wild expansion, ~4% RTP) (not implemented)
- **Symptom:** base game "a bit broken" / flat.
- **Our spec:** `math_vice_heat.json:279-280` `hotSpinChance1In: 80`, `hotSpinExpandsWilds: true`. **Rule:** on a 1-in-80 **natural or ante BASE** spin, every reel with a wild in its window expands to a full wild reel and the spin pays its **natural ways win with no multiplier** (`custom.towerMultiplierOnHotSpins: false` — hot reels carry **no** badge). **NEVER on a bought round** (expansion would erase the scatters the player paid for). A hot spin **can suppress a scatter trigger** — certified behaviour, do not "fix" it. All 5 reels hot + `fullBoardInstantMaxWin` = an **instant max win in the BASE game** (`viceSpin.ts:380`).
- **Certified contribution:** **3.76** points of wager on the natural game, **6.84** on the ante (`simResults.*.attributionPctOfWager`). ⚠️ The ante is priced on hot spins existing — see D4.
- **Dev gap:** absent.
- **Who fixes:** DEV (or accept the loss — ~3.8pp natural, and an under-priced ante).

## D9 — Phantom Hold & Win baked into the dev build (cleanup)
- The dev engine ships a COIN(id 9) Hold & Win bonus that triggers on 6+ coins (`SlotGame.sol:249-266,410-456`; dev `mockHost.ts:161-183`; `bonusMechanics.ts:36-47`). Our reels contain no id 9, so it never fires — harmless, but it is an unintended mechanic in the contract and should be disabled/removed for a clean Vice build.

## D10 — rtpBps/targetRtp overwritten at compile (cosmetic)
- Our preset carries **`rtpBps: 9670 / targetRtpPct: 96`** (`math_vice_heat.json:3-4`; preset `math.manifest` lines 31-32 — the older `9599 / 95.99` is void, see the certification block). `assembler.ts:52-53` recomputes from `expectedMetrics.rtpPct ?? 96`, which our manifest lacks, so it stamps `RTP_BPS=9600 / 96.0`. Affects only the contract's risk-reserve quote (`SlotGame.sol:156`), not payouts. **Fix:** US adds `expectedMetrics.rtpPct` to the manifest (see our-side doc), or DEV reads `rtpBps` directly.

## D11 — ~~WAYS EVALUATOR: a wild on reel 0 collapses the paytable to HIGH_A~~ — ❌ **RETRACTED. DO NOT IMPLEMENT.**

> ### ⛔ We were wrong. Please discard the previous D11 entirely.
>
> An earlier revision of this document told you that `_evaluateWins` seeding its candidate set from column 0 — and folding a wild there into `HIGH_A` — was a payout bug in your engine, and asked you to change both `WinEvaluator.ts` and **`SlotGame.sol:_evaluateWins`**. **That was a mistake on our side. Do not make that change.** If you already started it, revert it.

- **What we got wrong.** We saw a free-spins board where reel 0 was a full wild wall and only the shades guy (`HIGH_A`) paid, and concluded the evaluator was under-paying. It is not. The line
  ```solidity
  uint8 effectiveSym = (sym == SYM_WILD) ? SYM_HIGH_A : sym;   // SlotGame.sol:341
  ```
  is **the specified behaviour**, byte-identical in `WinEvaluator.ts:120`. A fully wild reel 0 is deliberately scored as ONE combination at the wild/HIGH_A rate — it does not open a separate combination for every paying symbol on the board.
- **The contract is the spec.** `SlotGame.sol` settles real money; the client only mirrors it. Our design-model Python simulator iterated every paying symbol, so it disagreed with the contract — the **simulator was the outlier, not the chain.** We had it backwards, and the "measured" 45.20× vs 153.96× comparison in the old text was simply the contract's answer next to a model that does not describe the product.
- **What happened when we "fixed" it.** We shipped a mirrored evaluator (`src/game/viceWays.ts`) that seeded every paying symbol. On screen, every symbol connected with every other symbol — highs with lows, all at once — which is exactly what you would expect once reel 0 offers a candidate set of everything. Noski caught it immediately. The file has been **deleted**; our `winEval` façade routes `ways` straight back to the engine evaluator, and it now carries a permanent comment so nobody re-opens this.
- **Consequence for the numbers.** Every RTP figure that was measured against the "corrected" evaluator is **void** — including the natural 95.91 / buy 95.93 / 96.11 / ante 96.40 table that the old D11 asked you to trust. The certification block at the top of this document is the re-measurement against the **contract's** rule, and it is the only table to use.
- **Nothing for you to do here.** Leave `WinEvaluator.ts` and `SlotGame.sol` exactly as they are. The RTP was restored to target by adding a real mechanic — per-reel **TOWER MULTIPLIERS** (see D12) — not by touching the evaluator.
- **The rule we work by now, and recommend to you:** when a simulator and the deployed contract disagree about what a board pays, **the contract wins**, and the simulator gets fixed. A payout rule is only a bug if the *contract* is wrong.

---

## D12 — TOWER MULTIPLIERS (new mechanic; the RTP is restored here, not in the evaluator)

This is the mechanic that puts the free spins back on target under the contract's evaluator. It is fully specified in `preset.math.manifest.custom` and implemented in `src/game/viceSpin.ts` (pure, seed-derived) + `src/dev/mockHost.ts`.

- **Rule.** Every reel that stands **fully wild** during a free spin is dealt a badge of **×1–×5**, drawn from `custom.towerMultiplierWeights` `[55, 20, 9, 6, 10]` (55% ×1 … 10% ×5). A winning combination pays × the **HIGHEST** badge it crosses — `custom.towerMultiplierRule: "highest-crossed"`.
- **What it is NOT.** Badges do **not** multiply together (a product model measured **187%** RTP on the 4-scatter buy) and they do **not** sum. Highest-crossed is the certified rule.
- **Scatter pay is never multiplied**, and nothing stacks on top of the 5-wild instant max win (`custom.fullBoardInstantMaxWin`) — that pays exactly `maxWinMultiplier × bet` and ends the round.
- **Sticky towers keep their badge** for the life of the round (`custom.towerMultiplierStickyRule`) — a tower is not re-rolled each spin.
- **Hot spins do not carry a badge** (`custom.towerMultiplierOnHotSpins: false`) — they expand wilds in the base game, where this mechanic does not apply.
- **Randomness namespace.** Badges are drawn from a **reserved seed namespace** (`1n << 200n` in `viceSpin.ts`) so the badge draw does not consume words from the reel-stop stream. Reels land identically with the mechanic on or off; this is what makes the two independent simulators agree. **Mirror this** — if you draw badges inline you will shift every stop and invalidate the certification.
- **Frequency, so you can sanity-check a build:** a ×5 badge reaches the board in **0.22%** of natural rounds (≈1 in 455).

## D13 — GUARANTEED TOWER on the 4-scatter buy

- `viceBuyStages` for the 4-scatter buy carries **`guaranteedTowerOnFirstSpin: true`** (+ `guaranteedTowerReel`). If the first free spin of a **bought** 4-scatter round would land with no fully-wild reel anywhere, that stage's reel is advanced to the next stop whose window contains a wild.
- **Why:** the buy is sold as "10 sticky tower spins". Without the guarantee **15.5%** of bought rounds — 1 in 6.4 — showed the player no tower at all. That is now **0%**; the guarantee fires on 83.6% of rounds, and the mean tower count at round end is **2.03**.
- It applies to the **bought** round only — never to a natural or ante trigger.
- The buy price is unchanged at **200×**; the certified RTP below is measured *with* the guarantee in place, so it is already paid for.

**Math ownership summary:** D1–D4, D6, D7, D9 are DEV-engine work — the preset already carries the full certified spec in `preset.math.manifest.custom`. D8 is shared. D10 (and the export-flattening half of D8) are the only items we fix in the preset/export. **D11 is retracted — no evaluator change on either side.** D12/D13 are new `custom{}` mechanics to port. Nothing in the win-evaluator's scatter/wild handling needs changing anywhere.

---

# SECTION B — PRESENTATION

The runtime `GameConfig` carries **no presentation at all**. `buildGameConfigFromMathProfile()` (`src/ui/generator/buildGameConfig.ts:33-75`) returns only `gridConfig, reelStrips, reelLengths, payTable, scatterPay, freeSpinsCount, freeSpinsCap, freeSpinsMultiplier, maxWinMultiplier, theme, nearMissTease, bonusBuyCost`. From our `features`/`mechanics[]` it reads exactly two flags: `nearMissTease = features.includes('near-miss-tease')` (`:67`) and `bonusBuyCost` (`:71-73`). Everything else is ignored, so presentation is **global and identical for every generated game**, decided by hardcoded runtime code. A grep of the dev `src/` for `chainwtf`, `presentationTuning`, `waysImmersive`, `tierArt` returns **zero** — you have no importer for our schema.

## B1 — Win marquee (procedural; needs an art consumer)
- **Symptom:** generic "basic generator yellow" plaque with hardcoded `BIG WIN!` / `MEGA WIN!` text instead of our neon Vice tier art.
- **Root cause:** the marquee is drawn **100% procedurally**. `buildWinBanner()` (`src/game/PixiApp.ts:1060-1116`) is all `Graphics` draw calls; the yellow is one constant `const gold = this.winBannerColorOverride ?? 0xFFD23F;` (`PixiApp.ts:1068`). The label is hardcoded: `const label = isMegaPlus ? 'MEGA WIN!' : isBigPlus ? 'BIG WIN!' : '';` (`PixiApp.ts:1132`). No `Sprite`/`Texture`/PNG is ever used.
- **Only knob is a single accent color** (`winBannerColorOverride`, set from chat param `winBannerColor` → `ACCENT_PRESETS`, `PixiApp.ts:1347-1350`, `adjustableParams.ts:35-43`) — no vice/neon option, and it only recolors the procedural plaque. **Do NOT treat `winBannerColor` as a workaround.**
- **Schema gap:** `GameTheme` (`src/engine/GameConfig.ts:49-99`) has no `winMarquee`/`tierArt`/`marqueeStyle` field. Note even the existing `theme.winBanner` token is unused by the marquee (only consumed as a CSS glow in `src/ui/generator/PixiPreviewPanel.tsx:178`).
- **Our preset already carries everything** (in a vocabulary you don't parse): mechanic `win-marquees` (preset line 52124); `assets.winTiers` (preset lines 52393-52403, `dir:"theme/win-tiers/"`, layers `big/mega/epic/max/win/plate`); and the load-bearing block **`extras.presentationTuning.winPresentation.marquee.tierArt`** (preset lines 52969-52976) mapping each tier to `theme/win-tiers/<tier>.png`, inside the `marquee` block (52925-52988) that also carries the bands (`minBigWin:15`, `mega:25`, `epic:100` — `:52930-52968`), the geometry, and the `coinRain` sheets (`:52977-52987`). ⚠️ **The path is `extras.presentationTuning.winPresentation.marquee`, not `extras.presentationTuning.marquee`** — an importer reading the shorter path gets `undefined` and silently falls back to the procedural yellow plaque, which is exactly the symptom above.
- **Concrete dev fix (two coupled changes):**
  1. Add an art field to `GameTheme` (`src/engine/GameConfig.ts`, after `winBanner` ~:57):
     ```ts
     winMarquee?: {
       tierArt: Partial<Record<'win'|'big'|'mega'|'epic'|'max'|'plate', Texture>>;
       bands?: { minBigWin: number; mega: number; epic: number };
       tierScale?: number[];
     };
     ```
     Populate it in the preset-importer from `preset.extras.presentationTuning.winPresentation.marquee` — `.tierArt` for the per-tier file map, `.config` for bands/geometry (**wire this one**, not `assets.winTiers`, which is just the bundling manifest).
  2. Branch `buildWinBanner()` (`PixiApp.ts:1060`): if `theme.winMarquee?.tierArt` present, blit `plate` as backing + the tier wordmark (win|big|mega|epic|max) selected via `resolveWinTier`/the preset bands as **Sprites**, and suppress the hardcoded `'BIG WIN!'/'MEGA WIN!'` text at `PixiApp.ts:1132`.

## B2 — Win-lines / win-presentation (hardcoded gold "Fruit-Fortune" look)
- **Symptom:** wrong win-line choreography — you show enlarge-pulse + a gold connecting line + coin ceremony; ours is immersive leap/dance + coin-rain tier marquee.
- **The line COLOR already matches** — both use `WIN_LINE_COLOR = 0xFFC53D`, `WIN_FRAME_COLOR = 0xFFF1B0` (dev `ReelSet.ts:36-37`; our preset records the same at preset line 4036). **The visible diff is the choreography, not the hue.**
- **Root cause:** win presentation is hardcoded. Dev win-line draw is `buildDecoration()` (`src/game/ReelSet.ts:525-628`: radial bloom :546, gold line underlay+core :580-581, node dots :586-593, reveal sweep :616-621, full-board light band :624-627). Per-win sequence `PixiApp.playWinSequence` (`PixiApp.ts:921-976`) → tally → `highlightWins` finale → `playCoinWin` coin ceremony + tier banner. The `winPresentation` registry (`src/registries/winPresentation.ts:9-42`) has only `dim-highlight-pulse`, `banner-pop`, `scatter-celebration` — **no ways/neon/immersive entry**. `winScreenTiers` (`src/registries/winScreenTiers.ts:23-90`) is a text-banner + screen-shake ladder, not our coin-rain tier-art marquee. The only knob is `winLineColor` (hue only, 6 presets, live-chat path only: `adjustableParams.ts:15-22,73-80`, `PixiApp.ts:1314-1320`).
- **Our preset (inert):** `ways-light` (preset lines 3355-3364, `sequential:"line-by-line"`, `cometHead:"small"`), `win-marquees` (3366-3382), `scatter-trigger-beat` (3406-3416); `extras.presentationTuning.winPresentation` (preset lines 3987-4119) describes `waysImmersive` (leap/dance jump 10-18px/tilt/slam, 3988-4008 — note `waysImmersive.enabled=true` **suppresses** the ways-light comet + line/dot decoration, ref our `ReelSet.ts:1918`). None of these IDs exist in your registry; a strict import flags them unknown (`src/generator/agents/validator.ts:614-648`) and defaults `winPresentation` to `[]` (`src/generator/agents/feature.ts:173`).
- **Concrete dev fix:** (1) add a `ways-immersive` win-presentation variant (symbol leap/dance jump/tilt/slam per our `json:3993-4007`, gold line + node dots suppressed when immersive is on); register it in `winPresentation.ts`. (2) Add the coin-rain tier-art marquee + tally-ticks (see B1). (3) Thread a per-game selector: add a `winPresentation`/`winLine` field to `GameConfig` (`src/engine/GameConfig.ts:77-99`), populate it in `buildGameConfig.ts:51-74`, branch in `ReelSet.buildDecoration` / `PixiApp.playWinSequence`. (4) At minimum wire `winLineColor` into `buildGameConfigFromMathProfile` so a config-driven build can set the line hue (currently only reachable via live chat).

## B3 — FS counters (dev shows bottom text; our plaques not rendered)
- **Symptom:** no Vice FS counter plaques; a generic FS badge/text shown instead.
- **Root cause:** dev shows a free-spins badge in the sidebar (`Sidebar.tsx:147-154`) and the FS entry/total via `PixiApp.playTransitionCard()` (`PixiApp.ts:985`) — a GSAP dim-plaque, text only. Our counter plaques are never rendered because the assets/config never reach the engine.
- **Our side (see our-side doc D3):** `src/App.tsx:581-584` → `setFsPlaquePair(free_spins_counter.png, total_win_counter.png)`. These plaque assets are **not currently shipped in the handoff or referenced in the preset** — we are fixing that. Once shipped + referenced, the engine needs to consume a per-game FS-counter-plaque pair and render it in the FS round (instead of / in addition to the bottom text).

## B4 — Intro / bg-transition (instant jump, no transition)
- **Symptom:** the game "jumps INSTANTLY to the slot" with no boot/intro/background transition.
- **Confirmed again on your latest preview (Noski, 2026-07-27):** the intro cards render **directly on top of the reel grid** the moment the slot opens — no loading screen, no boot background, no iris. On our build the same cards sit on the game-intro BACKGROUND and only reveal the reels after `transitionOut: "iris-from-black"`. So the assets are arriving and drawing; what is missing is the **flow that owns them**. Because no boot/intro stage exists, the cards have nowhere to live and land over the grid. **This is a flow bug, not an asset bug — do not re-cut the art.** Implement `flow.stages` (`boot` → `game-intro` → `base`) and the cards will sit where they belong. `flow` is carried in the preset (`flow.iris` `:52509`, `flow.stages[]` `:52512`, `assets.introLayers` `:52404`, `extras.presentationTuning.layout.introScreens` `:53133`) and is currently read by nothing on your side.
- **Root cause:** there is **no intro/boot/iris system** in the engine. `grep intro|boot|splash|iris` across the dev runtime (`App.tsx`, `PixiApp.ts`, `useGameState.ts`, `GameCanvas.tsx`) returns nothing. `src/App.tsx:14-60` mounts `GameCanvas` straight to the base reels. The only "transition" is `PixiApp.playTransitionCard()` (`PixiApp.ts:985`, called :849/:912) — a FS-entry/total dim-plaque, not a boot→game transition. `transitionAnimations.ts`'s only intro-ish entry `base-to-fs-intro` (:28-37) is `implemented:false` and FS-scoped. Background is a procedural gradient from theme colors (`PixiApp.ts:287-330, 517-534`); a real bg image can only come via `setBackgroundImage(dataUrl)` (`PixiApp.ts:683-723`), a **wizard-only** upload path — not a deploy/preset channel and not in `GameConfig`.
- **Our preset fully specifies the intro** (all unread): `flow.iris.style="looney-iris"` (preset :52509-52511); `flow.stages[]` — `boot` (:52513-52579), `game-intro` with `transitionOut:"iris-from-black"` (:52580-52584), `base` (:52585-52588), `fs-intro` with `transitionIn:"iris"` (:52601-52602); `assets.introLayers` → `data/introLayers.json` + `theme/vice/intro/` (:52404-52407); **`extras.presentationTuning.layout.introScreens`** (18-layer game intro + fs3/fs4/outro, :53133-53139) + `layout.background.fsIntroImage` (:53117). ⚠️ These live under **`extras.presentationTuning.layout`** — there is no `extras.layout` key in the preset; an importer reading `extras.layout.*` gets `undefined` and you ship the hard cut you have today.
- ⛔ **The `boot` stage is the universal CHAIN GAMES loader, not a Vice screen.** `flow.stages[0]` (:52513-52579) is platform branding — the `chain_loader_sheet.webp` logo build-in (8×8 grid of 250px frames) + a hairline progress bar on `#07070c`, mounted **inside the game iframe only**, identical in every game the generator produces. Full spec: `dev-handoff/features/boot-loader/README.md` and **FLOW.md Stage 1**. The `extras.presentationTuning.layout.bootScreen` block (:53140-53149, "VICE HEAT" title + pink→amber gradient) is the **retired per-game boot screen it replaced** — kept only as history. **Do not build a per-game boot screen, title or colour ramp from it.**
- **Concrete dev fix (minimum):** add a `boot → game-intro → base` phase that (1) reads `flow.stages`, (2) renders the universal CHAIN GAMES loader per `flow.stages[0].params` / `features/boot-loader/`, (3) cross-fades into `assets.introLayers` (manifest `data/introLayers.json`, dir `theme/vice/intro/`) laid out per `layout.introScreens`, (4) plays `transitionOut = "iris-from-black"` before revealing the base reels. Make `flow.iris:"looney-iris"` a real `implemented:true` transition. If the full intro is out of scope for Thursday, the smallest acceptable fix is loader→base **crossfade** honoring `transitionOut`, so the game stops hard-cutting into the reels.

**Broader presentation root cause (features "override so it doesn't fit"):** `theme:"vice"` (preset :12) is not one of the six hardcoded themes (`themes.ts:122-129`), so `getThemeByName("vice")` → `DEFAULT_GAME_THEME` (chain.wtf blue, `themes.ts:133-142`). `GameTheme` (`GameConfig.ts:49-75`) is colors/labels/icons only — no background/frame/logo/atlas fields — so none of our Vice art can attach; the deployed path only loads art via the wizard `setBackgroundImage` upload (`PixiApp.ts:683-723`), never from the preset. **DEV must add a per-game art channel:** register a `vice` `GameTheme`, or (better) extend `GameConfig`/`renderGameConfig` with `assets.images.{background,logo,frame}`, `assets.symbols.*` atlases, `assets.spritesheets.backgroundLoop`, and load them in `PixiApp.init()` for the **deployed** path.

---

# SECTION C — AUDIO

The dev event vocabulary is **fixed** — exactly 12 registry keys (`src/registries/soundEvents.ts:21-154`; `docs/layer-specs/sound.md:32` declares it immutable). Files resolve **flat** as `/audio/<id>.{wav,ogg,mp3}` (`src/audio/defaultSoundConfig.ts:36,43`; manifest `src/generator/soundManifestRenderer.ts:84`). Unknown IDs are **silently dropped** at compile (`soundManifestRenderer.ts:71-73`); missing bindings are graceful silence at runtime (`SoundManager.ts:105-108`).

**Most of the audio breakage is OUR-side** (we ship our studio's own event keys + nested `audio/library/<cat>/<file>.ogg` paths the engine never reads; we are remapping to your flat vocabulary — see our-side doc). **The DEV-side portion is two event keys your live build fires that are NOT in the snapshot registry:**

| Dev live fires | Our current key (same sound) | Our file | Status |
|---|---|---|---|
| `win-screen-music` | `win-marquee` (preset :3657, :4301) | `.../win-marquee/payout-award-d55ce2.ogg` | not in dev registry → silent win screen |
| `connect-symbol` | `coin-chime` (preset :3676; note :4333 "connection swish") | `.../coin-chime/space-coin-win-notification-cc796e.ogg` | live-renamed from `celebration:coin` → silent connections |

- **`'win-screen-music' unavailable — running silently`** and **`'connect-symbol' unavailable — running silently`** are the two symptoms. Both are the same sound under two names. **DEV action:** confirm the exact live key spelling — these two keys are fired by the live build but are **not in the snapshot registry** (`soundEvents.ts` / `sound.md:32`). If they are now real registry keys, our-side rename+flatten (below) fully resolves them; that is the one fact we cannot verify from the snapshot (the source zip lags the live generator).
- **Our-side remap (the bulk):** rename `win-marquee → win-screen-music`, add `connect-symbol`, fix ambient to `gimme-that-groove` @ 0.06 (currently the stale purged `adone-6fddec.ogg` at preset :3650), and flatten all paths from `audio/library/<cat>/<file>.ogg` → `/audio/<id>.ogg` + physically deliver those files. Full mapping table is in `VICE_HEAT_OUR_SIDE_FIXES.md`.
- **Events with NO dev dispatch at all** (`wild-land`, `wild-expand`, `tease-riser`, `tease-miss`, `win-tally-tick`, `win-tally-end`, `tier-up` — preset :4310,4314,4345,4350,4355,4360,4365): per the immutability contract these will never fire unless DEV adds registry entries + `useSoundLayer` dispatch. Decide with us whether these presentation beats are in scope for the generator.

**"Detached marquee music (~1 min)" timing bug:** these five audio/sound analyses did **not** isolate a separate ~1-minute detached-timing defect. The "wrong / detached marquee music" symptom traces to the `win-marquee → win-screen-music` misname (silent → whatever loops instead) plus the `marqueeDucksAmbient` exclusive group `[ambient-music, win-marquee]` (preset). **DEV: please verify the duck/exclusive-group release timing once the win-screen-music key resolves** — if the exclusive group is keyed on our old `win-marquee` name it may never release the ambient duck, which would read as detached/hanging marquee music. Flagged for confirmation, not yet root-caused.

---

# SECTION D — LAYOUT / IFRAME / CONTROL BAR

Both engines share the **exact same design box (688×708 for Vice 5×5)** and the **same fixed-aspect fit-to-viewport algorithm** — neither full-screen-stretches. The grid lands differently for three independent reasons: (1) control placement (dev 260px LEFT sidebar vs our bottom bar changes the canvas rectangle), (2) diverged `onResize` constants, (3) stage aspect-lock.

## D-ref — Canonical design box (both must use)
- Cell metrics identical in both repos: `src/config/gridConfig.ts:28-33` `symbolWidth 120, symbolHeight 110, symbolGap 6, reelGap 8`; `src/game/symbolMetrics.ts:20-34` `CELL_HEIGHT = 116`.
- Grid footprint (`ReelSet.ts:466-472`, formula `gridConfig.ts:167-170`): **totalWidth = 5×120 + 4×8 = 632**, **totalHeight = 5×116 = 580** → **632 × 580 px**.
- Scene box (`PixiApp.ts:51-54` `FRAME_PAD 28`, `HEADER_H 52`, `FOOTER_H 20`; assembled :574-577): `rw = 632+28×2 = 688`, `rh = 580+28×2 = 636`, `totalH = 52+636+20 = 708`, `totalW = 688`.
- **REFERENCE DESIGN BOX = 688 × 708, aspect 688/708 = 0.972 : 1** (slightly taller than wide). Our studio box for 5×5 = `5/5.15 = 0.9709` (`src/ui/GameCanvas.tsx:125`) — deliberately matched.

## D1L — Switch from 260px left sidebar to a bottom control bar
- **Dev ships a LEFT sidebar, not a bottom bar:** `src/ui/Sidebar.tsx:84` `<aside class="w-[var(--sidebar-width)] …">`, **260px** fixed (`styles/globals.css:83 --sidebar-width:260px`), full height, does not scale, reserves horizontal space (flex sibling). Registry `src/registries/uiConfigs.ts:9-27` `sidebar-standard`, `implemented:true`. The `bottom-bar` layout (`uiConfigs.ts:28-45`) is registered but **`implemented:false`, v0.1.0, "Requires full layout rewrite — deferred to V2."**
- **Fix:** flip `uiConfigs.ts:28-45` `bottom-bar` to `implemented:true` and build the production bottom bar by porting our `src/ui/ControlBar.tsx` (a 1:1 rebuild of the external chaingames-complete package: `DESIGN_W 1200`, `STRIP_H 150`, bar `978×124` at `BX 111, BY 543`, `ControlBar.tsx:42-44`; responsive `scale = boxWidth/1200`, `:66-82`). Retire the 260px left sidebar for the production skin. Update `AGENT_CONFIG_REFERENCE.md:474-511` (§11 currently mandates the sidebar).

## D2L — Adopt our tuned onResize constants
- **Dev `onResize()`** (`devgen/.../game/PixiApp.ts:459-488`): `margin 40` (:470-471), `scale = min(scaleX, scaleY, 1.3)` (:474, cap 1.3), `sceneRoot.y = round((height − 708*scale)/2)` (:478, dead-center, **no bottom reserve**). No `bottomHudFraction` anywhere (grep = 0 hits).
- **Our `onResize()`** (`src/game/PixiApp.ts:569-655`, ways branch): `margin 14` (:607), `scale = min(scaleX, scaleY, 1.7) × 0.98` (:619), `bottomReserve` driven from `bottomHudFraction` (:624), grid centered in the area **above** the reserve (:638).
- **Fix:** replace the dev's `min(…,1.3)` / margin-40 / dead-center block (`devgen/.../PixiApp.ts:470-478`) with our `src/game/PixiApp.ts:569-655` verbatim.

## D3L — Reserve the bottom band from bottomHudFraction 0.125
- **Fix:** aspect-lock the stage to ~0.972 (or clamp bar width) and set **`bottomHudFraction = 0.125`** so the reserved band equals the actual bar height. Bar on-screen height = `150 × boxWidth/1200 = 12.5% of the game-box width` (`ControlBar.tsx:66-82`). `bottomHudFraction` is documented as `150/1200 = 0.125` in `PixiApp.ts:209-211` but defaults to 0. Without aspect-lock, a width-based bar height ≠ a height-based reserve on wide screens.

## D4L — Port the left-rail logo layout (absent dev-side)
- **Dev has no `'left'` logo layout at all** (grep = 0 hits — studio-only addition). Our runtime: `src/App.tsx:580` → `setTitleImage(logo.webp, 'left')`; `src/game/PixiApp.ts:716` signature `layout:'top'|'left'`; `alignLeftRailLogo()` `:774`; broadcast `slot:leftrail` `:808`.
- **Fix:** port `setTitleImage(url,'left')` + `alignLeftRailLogo` (`PixiApp.ts:716-810`) so the Vice logo lands on the left rail where the studio puts it. (Note our exporter currently omits the `'left'` arg — we are fixing that our-side, see our-side doc D2.)

## D-inv — Full control-bar control inventory (port these to the bottom bar)
Our `ControlBar.tsx:191-267` controls:
- Left icons: **sound on/off (mute)**, **dice (provably-fair/RNG)**, **help (rules/paytable)** (`:191-194`)
- **CREDIT** (balance) row + coin + value (`:196-199`)
- **BET** row + coin + value; **Vice ante** line "ANTE ×N · €x/SPIN" when active (`:201-211`)
- Center status "START AND WIN" / "WIN x.xx" (`:213-219`)
- Right cluster (baked idle-arrows / stop-square) with transparent hit-zones: **Bet −**, **Spin/Skip**, **Bet +**, **Autoplay (10 spins) / Stop autoplay** (`:221-247`)
- Autoplay-on green tint overlay (`:229-241`)
- **BONUS BUY** button above the bar (`:249-267`)

Dev sidebar currently has (for parity reference, `Sidebar.tsx:86-251`): Manual/Auto toggle, Turbo ⚡, Audio volume+mute, Bet input with ½/2× chips, FS badge, Auto-spin count `[10,25,50,100]`, Spin/Skip/Stop-Auto CTA, Buy Bonus (when `bonusBuyCost` set), Win Chance, Profit on Win, Total Win, Recent Bets + fairness modal, wallet-not-ready warning.

**Parity note:** our production bar intentionally omits turbo-in-bar, volume slider, auto-count choices (25/50/100), and the Win-Chance/Profit/Total-Win/Recent-Bets stats; it adds the Vice ante readout + baked-art cluster + bonus-buy rail. If sidebar-feature parity is required, add those controls to the bottom bar; otherwise document the omission.

**Net for Section D:** make both render into the **same fixed-aspect box (688×708 / 0.972)** with the **same `onResize` constants** and a **12.5%-of-width bottom-bar reserve**, and move the dev off the 260px left sidebar onto the ported bottom bar + left-rail logo. Then grid, logo, and bar land proportionally identically; only absolute pixel size differs.

**Key layout files:** `devgen/.../game/PixiApp.ts:34-37, 459-488` · `devgen/.../ui/GameCanvas.tsx:63-74` · `devgen/.../ui/Sidebar.tsx:84, 86-251` · `devgen/.../App.tsx:72-90` · `devgen/.../registries/uiConfigs.ts:9-48` · `devgen/.../styles/globals.css:83` · `devgen/.../AGENT_CONFIG_REFERENCE.md:474-511`. Ours: `src/game/PixiApp.ts:51-54, 209-211, 569-655, 716-810` · `src/config/gridConfig.ts:28-33, 167-170` · `src/game/ReelSet.ts:466-472` · `src/game/symbolMetrics.ts:20-34` · `src/ui/GameCanvas.tsx:57-59, 125, 145-147` · `src/ui/ControlBar.tsx:42-44, 66-82, 191-267` · `src/config/mathProfiles.ts:150-153`.

---

# SECTION E — GAME RULES / INFO SCREEN

The dev's rules/info screen needs Vice-specific content. **WE supply the copy/values** — the authoritative page-by-page copy is `dev-handoff/VICE_HEAT_RULES_CONTENT.md`; the values below must match it. Required content:
- **Paytable — the SHIPPED values**, read verbatim from `math.manifest.payTable` / `scatterPay` (preset lines 246-292; flat root copy at 26292-26338). All figures in **bps — divide by 10000 for × bet**; the three entries are **3-of-a-kind / 4-of-a-kind / 5-of-a-kind**:

  | symbol | 3 | 4 | 5 | | symbol | 3 | 4 | 5 |
  |---|---|---|---|---|---|---|---|---|
  | `wild` | 1243 | 2034 | 3616 | | `lowE` | 1164 | 1356 | 1808 |
  | `highA` | 1243 | 2034 | 3616 | | `lowF` | 1164 | 1299 | 1638 |
  | `highB` | 1198 | 1808 | 2938 | | `lowG` | 1164 | 1243 | 1469 |
  | `midC` | 1164 | 1582 | 2373 | | **`scatterPay`** | **1164** | **2260** | **6780** |
  | `midD` | 1164 | 1469 | 2147 | | | | | |

  The pay **floor is 1164 bps = 0.1164× bet**. ⛔ The old `scatterPay [768, 1490, 4471]` / 768-bps (0.0768×) floor this section used to print is **void** — a build shipped on it under-pays every low-symbol line and every scatter award. `minWager 10000`.
- **Ways count:** 5×5 ways-pays, left-to-right, `MIN_MATCHING_REELS 3` → **3125 ways**. Ensure the compiled contract is 5×5 (3125 ways), **not** the engine default 5×3/243.
- **RTP: 96.46%** natural (certified — see the certification block at the top; buy-3sc 96.20%, buy-4sc 95.97%, ante 96.00%). `rtpBps 9670`; note the contract `RTP_BPS` compiles to 9600 unless D10 is fixed. **95.99% is void — do not print it on the info screen.**
- **Max win: 5000×** (`maxWinMultiplier 5000`, matches dev hard cap). Two routes only: 5 fully-wild reels pay it **instantly** and end the round, in either bonus; otherwise the running total is capped at it.
- **Feature descriptions:** tiered free spins (**3sc → 7 spins**, wilds expand per spin / **4sc → 10 spins**, STICKY towers to **cap 5**), **tower multipliers ×1–×5** on every fully-wild reel — a win pays × the **highest** badge it crosses, scatter pay never multiplied — retrigger **+3** spins, hot spins (1-in-80 base spins, all wild-carrying reels expand, no multiplier, never on a bought round), staged bonus buys (100× / 200×, the 200× buy **guarantees a tower**), ante bet (3.25× for ~3× FS chance). ⛔ **Do not describe simultaneous-expansion multipliers or a full-house ×2** — both retired (D2).

Cross-reference: the paytable/feature copy is maintained on our side and delivered with the preset — coordinate on the exact strings before wiring the info modal (the dev's Recent-Bets fairness modal exists, but no paytable modal is currently wired — `winPresentation`/UI notes above).

---

# PRIORITIZED FIX ORDER

1. **D8 — verify the ingestion object first** (could be the whole story; ~5 min). Confirm `preset.math.manifest` (not `preset`/`preset.math`) reaches `configFromMathProfile`.
2. ~~D11 — the ways-evaluator wild-on-reel-0 bug.~~ ❌ **RETRACTED — do nothing.** If a previous revision of this list had you editing `_evaluateWins` or `SlotGame.sol`, revert it. See D11.
3. **D1 + D2 — expanding wilds + sticky towers (cap 5) + the full-board instant max win** (with 3b below, this is the ~48pp of RTP that lives in `custom{}`). Reference: **`dev-handoff/features/round-core/viceSpin.ts:405-520`** (= `src/game/viceSpin.ts`), which reads the exact `custom{}` keys the preset ships. ⛔ **No simul ladder, no full-house ×2** — both retired; see D2.
3b. **D12 — tower multipliers ×1–×5.** Port with D1/D2; without it the free spins land well under the certified RTP. Draw the badges from a **reserved seed namespace** so reel stops are unaffected.
3c. **D13 — guaranteed tower on the 4-scatter buy.** Small, and it is what the 200× buy promises.
4. **D3, D4 — staged buys + ante** (only if those buttons ship at launch).
5. **Section D layout** — switch to bottom bar + tuned onResize + left-rail logo (biggest visible fix after RTP).
6. **B1/B2 marquee + ways-immersive; B4 intro** — presentation richness.
7. **D6 retrigger amount, D7 hot-spins; C audio dev-side keys** — correctness/feel.
8. **D9, D10, D5-note; B3 FS counters (after our asset delivery)** — cleanup.
