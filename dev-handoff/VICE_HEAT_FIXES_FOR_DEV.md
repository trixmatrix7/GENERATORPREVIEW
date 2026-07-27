# Vice Heat — Engine Fixes Required (Dev-Facing Spec)

**Status:** Launch-blocking. Target launch: **Thursday.**
**Preset under discussion:** `dev-handoff/preset/vice-heat.chainwtf-preset.json` (schema `chainwtf-game-preset` v2).

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

**Reference implementation for ALL math:** our settlement engine `src/dev/mockHost.ts:407-548` reads the exact `custom{}` keys the preset already ships — port from there.

---

## 0. Executive summary — read this first

Vice Heat was built and certified in our preview studio (`C:/Users/noski/Downloads/GENERATOR PREVIEW/src`). We export a preset JSON; your generator (`devgen/slots_game-main`, live on CloudFront) compiles it. **Your ingestion channel is math-only + theme colors/asset art.** It silently drops (a) our preset's entire `math.manifest.custom{}` block and (b) our entire presentation config (`flow`, `assets`, `extras.presentationTuning`, our `mechanics[]`). All rich presentation — marquee, win-lines, FS counters, intro, control bar — is drawn **hardcoded / from fixed registries / procedurally** in your engine, so it overrides ours.

**The single most important number: ~65% of the certified RTP is missing.** Vice's 95.99% RTP is produced almost entirely by a free-spins engine that **expands wilds into full-reel walls** (plus simultaneous-expansion multipliers, sticky towers, a full-house multiplier, staged buys, an ante). All of that lives in `custom{}`, which every dev-side consumer drops. Our own `simResults` (`math_vice_heat.json:3232-3260`) attribute RTP as base ≈29.6%, hot-spins ≈4.2%, FS-3sc ≈32.5%, FS-4sc ≈30.0%. Your build keeps only the base ways + an unmultiplied (`freeSpinMultiplier=1`) plain FS → **live RTP lands around a third of target.** That is the "math majorly wrong," and it is why the base game "feels dead" (base alone ≈28% RTP; the game was designed to live in the bonus).

**VERIFY D8 FIRST.** Before implementing anything, confirm which object you passed into `buildGameConfigFromMathProfile` / `configFromMathProfile`. Our math is nested under `preset.math.manifest`; your loaders read those keys at the **profile root**. If you fed `preset` or `preset.math` instead of `preset.math.manifest`, `reelStrips` is `undefined` and the game **silently falls back to the Fantasy 5×3 default** — which alone would explain "fundamentally wrong." This is a five-minute check that could be the whole story.

**Symbol identity is NOT a bug.** Both engines agree WILD=0 / SCATTER=1; your win-eval never lets a wild pay as a scatter, nor lets scatters form ways (byte-identical to ours). See D6 for what "scatters connect through the wilds" actually is.

---

# SECTION A — MATH / MECHANICS (highest priority)

All "our spec" lines are `src/data/math_vice_heat.json` unless noted; the same values appear in the preset under `math.manifest` / `math.manifest.custom`. All "reference impl" lines are our engine `src/dev/mockHost.ts`. All "dev gap" lines are under `devgen/slots_game-main/`.

| ID | Mechanic | Severity | Owner |
|----|----------|----------|-------|
| **D11** | **Ways evaluator: wild on reel 0 collapses the paytable to HIGH_A** | **Launch-blocking (underpays)** | **DEV (same bug, byte-identical)** |
| D8 | Ingestion object (nested vs flat root) | **VERIFY FIRST** | Coordinate |
| D1 | Expanding wilds in FS | Launch-blocking | DEV |
| D2 | Sticky towers / simul-multipliers / full-house | Launch-blocking | DEV |
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
- **Our spec:** `math_vice_heat.json:272` `"expandingWildsInFreeSpins": true`. **Reference impl:** `src/dev/mockHost.ts:458-478` — before ways eval, every wild-carrying reel is overwritten to full wild (`fsBoard[row][reel] = 0`). Config mapping: `src/config/mathProfiles.ts:60` (`custom.expandingWildsInFreeSpins → config.expandingWildsInFS`).
- **Dev gap (no expansion anywhere):**
  - Contract `contract/src/SlotGame.sol:227-246` — FS loop just re-evaluates the raw board × flat `FREE_SPIN_MULTIPLIER`.
  - Dev harness `src/dev/mockHost.ts:140-158` — `fsWin = rawFsWin * freeSpinsMultiplier`.
  - Validator sim `src/generator/validator/simulator.ts:256-277` — same.
  - `GameConfig` interface (`src/engine/GameConfig.ts:77-99`) has no expanding-wild field; `contractRenderer.ts:16-43` and `assembler.ts:15-56` never read `custom`.
- **Who fixes:** DEV. No preset key can enable this; the mechanic must be built.
- **Concrete fix:** In the FS loop, before `_evaluateWins`, port `src/dev/mockHost.ts:458-478`: for each reel where any visible cell == 0, set the whole reel column to 0 (WILD). Gate on a new config flag read from `custom.expandingWildsInFreeSpins`.

## D2 — Sticky towers / simul-expand multipliers / full-house (not implemented)
- **Symptom:** "mechanics fundamentally wrong, many things missing"; the entire 4-scatter max-win route is absent; volatility and top-end wrong.
- **Our spec:** `math_vice_heat.json:273-282` — `stickyExpandingFrom4Scatters`, `stickyTowerCap:3`, `stickyRoundSpins:10`, `stickyRoundCap:13`, `simulExpandMultipliers:{3:2,4:10}`, `stickyFullBoardMultiplier:1`. **Reference impl:** `src/dev/mockHost.ts:459-469` (sticky towers), `:510-516` (simul-expand table), `:517-527` (full house); FS win line `:527` `rawFsWin * simulMult * fullMult * freeSpinsMultiplier`.
- **Dev gap:** none of `stickyTowerCap`, `simulExpandMultipliers`, `stickyFullBoardMultiplier`, `stickyRoundSpins/Cap` exist in any dev file (grep across `devgen/.../src` = zero engine/settlement hits). Bonus registry `src/registries/bonusMechanics.ts:9-48` offers only `free-spins-multiplier`, `bonus-buy`, `hold-and-win`.
- **Who fixes:** DEV.
- **Concrete fix:** Port the sticky/simul/full-house blocks from `src/dev/mockHost.ts:459-527`, reading the same `custom` keys.

## D3 — Staged bonus buys (buy-3sc @100×, buy-4sc @200×) (not implemented)
- **Symptom:** buy feature missing or paying the wrong round.
- **Our spec:** `math_vice_heat.json` `custom.viceBuyStages[]` (from ~`:286`; stage1 100×, stage2 200×, each with its own certified `fsReelStrips`, `simulExpandMultipliers`, `stickyTowerCap`, `stickyFullBoardMultiplier`). In the preset: `math.manifest.custom.viceBuyStages` stage1 = 3sc/costMult 100 (preset lines 316-318), stage2 = 4sc/costMult 200 (preset lines 568-570). **Reference impl:** `src/dev/mockHost.ts:232-243, 274, 327-349, 514-525`.
- **Dev gap:** only a single scalar `bonusBuyCost` / `BONUS_BUY_COST_X100` (`SlotGame.sol:28,209-224`; `buildGameConfig.ts:71-73`; `bonusMechanics.ts:24-35`). No concept of multiple stages, per-stage strips, or per-stage multiplier overrides. `assembler.ts:25-29` wires only a single buy cost, and only if the `bonus-buy` flag is set.
- **Who fixes:** DEV (multi-stage buy) — or descope to a single buy for launch.
- **Concrete fix:** Implement a staged-buy path keyed on `gameData = abi.encode(uint8 stage)` reading `custom.viceBuyStages`, mirroring `src/dev/mockHost.ts:232-349`.

## D4 — Ante bet ("3× FS chance", 3.25× cost) (not implemented)
- **Symptom:** ante toggle missing / no strip swap.
- **Our spec:** `math_vice_heat.json` `custom.anteBet{ costMult:3.25, reelStrips[] }` (from ~`:3008`); preset label `"3x FREE SPINS CHANCE"`, `costMult 3.25`, `certifiedRtpPct 94.92` (preset lines 3036-3257). **Reference impl:** `src/dev/mockHost.ts:233,239,261` (swaps to the ante reel strips for the ante spin).
- **Dev gap:** no `anteBet` anywhere; no strip-swap mechanism in `SlotGame.sol` / dev `mockHost.ts` (single fixed `REEL_STRIPS`).
- **Who fixes:** DEV.
- **Concrete fix:** Add an ante code path (stage 3) that swaps to `custom.anteBet.reelStrips` for the triggering spin, per `src/dev/mockHost.ts:239,261`.

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
- **Secondary — retrigger AMOUNT is also wrong:** dev adds a full `FREE_SPINS_COUNT` (7) per retrigger (`SlotGame.sol:243` `remaining += FREE_SPINS_COUNT`); our spec is `retriggerSpins:3` (`math_vice_heat.json:267`), which the dev engine has no field for. **Fix:** DEV reads `custom.retriggerSpins` (see our `mockHost.ts:537-539`).

## D7 — "Hot spins" base-game feature (1-in-80 wild expansion, ~4% RTP) (not implemented)
- **Symptom:** base game "a bit broken" / flat.
- **Our spec:** `math_vice_heat.json:283-284` `hotSpinChance1In:80`, `hotSpinExpandsWilds:true`; contributes `hot_pct ≈4.15%` (`:3258`).
- **Dev gap:** absent.
- **Who fixes:** DEV (or accept the ~4% RTP loss).

## D9 — Phantom Hold & Win baked into the dev build (cleanup)
- The dev engine ships a COIN(id 9) Hold & Win bonus that triggers on 6+ coins (`SlotGame.sol:249-266,410-456`; dev `mockHost.ts:161-183`; `bonusMechanics.ts:36-47`). Our reels contain no id 9, so it never fires — harmless, but it is an unintended mechanic in the contract and should be disabled/removed for a clean Vice build.

## D10 — rtpBps/targetRtp overwritten at compile (cosmetic)
- Our preset carries `rtpBps:9599 / targetRtpPct:95.99` (`math_vice_heat.json:3-4`). `assembler.ts:52-53` recomputes from `expectedMetrics.rtpPct ?? 96`, which our manifest lacks, so it stamps `RTP_BPS=9600 / 96.0`. Affects only the contract's risk-reserve quote (`SlotGame.sol:156`), not payouts. **Fix:** US adds `expectedMetrics.rtpPct` to the manifest (see our-side doc), or DEV reads `rtpBps` directly.

## D11 — WAYS EVALUATOR: a wild on reel 0 collapses the whole paytable to HIGH_A (**underpays; both engines**)

- **Symptom:** on a board where reel 0 is a full wild reel, only ONE symbol combination pays. Noski hit it in a sticky free-spins round — towers standing on reels 1/2/4 and only the shades guy (HIGH_A) connected, while J, K and the briefcase visibly should have.
- **Root cause (in YOUR engine too — this code is byte-identical to ours):** `evaluateWins` seeds its candidate-symbol set from **column 0 only**, and folds a wild there into HIGH_A:
  ```ts
  const sym = board[row][0];
  if (sym === SymbolId.SCATTER) continue;
  const effectiveSym = sym === SymbolId.WILD ? SymbolId.HIGH_A : sym;   // <-- the bug
  if (evaluatedSymbols.has(effectiveSym)) continue;
  ```
  (ours: `src/engine/WinEvaluator.ts:113-123`; yours: same function, plus `SlotGame.sol:340-341`.)
  Seeding from column 0 is a legitimate shortcut — a left-to-right ways win must start on reel 0, so only symbols visible there can pay. But a **wild substitutes for every symbol**, so a wild in column 0 should open the door for all of them. Mapping it to HIGH_A instead means a full wild reel 0 yields the candidate set `{HIGH_A}` and at most one combination can ever pay — even though the counting loop right below (`cell === effectiveSym || cell === SymbolId.WILD`, ours `:138`, yours `WinEvaluator.ts:138` / `SlotGame.sol:351`) already substitutes wilds for anything.
- **Measured on the reported board** (towers on reels 0,1,3; reel 2 = `[K, shades, J, briefcase, J]`; reel 4 = `[J, J, shades, car, white-suit]`) with the shipped paytable:

  | | combinations | total |
  |---|---|---|
  | current engine | shades guy 5-of-a-kind, 125 ways | **45.20×** |
  | correct model | + briefcase 4oak 18.36× + K 4oak 16.95× + **J 5oak, 500 ways, 73.45×** | **153.96×** |

  The player received **29.4%** of what the certified math owed.
- **Blast radius (measured, 300k boards per mode on the shipped Vice strips):** base game — 7.6% of boards change value, ways RTP component **47.15% → 52.74%** (+5.6pp); free spins — **73.85% → 92.78%** (+18.9pp). It bites on **any board with a wild anywhere in column 0**, which is ~12.5% of base spins (reel 0 carries one wild in 40 stops) and effectively every expanded free spin — not just sticky rounds.
- **This is a PAYOUT bug, not a display bug.** Settlement and presentation both score through the same evaluator, so the game genuinely paid less. Our certified simulator has always used the correct model (`math/simulate_vice_heat_v2.py:171-183` iterates every paying symbol), so **the runtime has been paying under its own certification** — the published RTP did not describe the shipped build.
- **Our fix (ours, already shipped):** we did NOT edit `src/engine/*` (it stays byte-identical to your repo). We added `src/game/viceWays.ts`, a mirror of the engine evaluator whose ONLY difference is the candidate set — every paying symbol id in the paytable, wild and scatter excluded — and routed the `ways` model to it through our `winEval` façade, which fixes settlement and presentation in one edit.
- **Verification we ran (recommend you repeat it):** across **548,631** fuzzed boards with no wild in column 0 the two evaluators produced **identical combination sets** — the correction is provably a no-op wherever the shortcut was valid, so it cannot regress a non-expanding ways game.
- **Concrete dev fix:** replace the column-0 seeding loop with an iteration over every paying symbol id in the paytable (skip WILD and SCATTER), keeping everything else — scatter block, per-reel counting, consecutive-from-reel-0 matching, ways product, pay-index caps, bps arithmetic — untouched. Mirror the same change in `SlotGame.sol:_evaluateWins` so the contract and the client agree. **Re-run your RTP simulation afterwards: this raises Vice's RTP materially, and the paytable is being re-fitted on our side to land back on target — take the re-certified `payTable`/`scatterPay` from the updated preset, do not keep the old numbers with the corrected evaluator.**

**Math ownership summary:** D1–D4, D6, D7, D9 are DEV-engine work — the preset already carries the full certified spec in `preset.math.manifest.custom`. D8 is shared. D10 (and the export-flattening half of D8) are the only items we fix in the preset/export. Nothing in the win-evaluator's scatter/wild handling needs changing on either side.

---

# SECTION B — PRESENTATION

The runtime `GameConfig` carries **no presentation at all**. `buildGameConfigFromMathProfile()` (`src/ui/generator/buildGameConfig.ts:33-75`) returns only `gridConfig, reelStrips, reelLengths, payTable, scatterPay, freeSpinsCount, freeSpinsCap, freeSpinsMultiplier, maxWinMultiplier, theme, nearMissTease, bonusBuyCost`. From our `features`/`mechanics[]` it reads exactly two flags: `nearMissTease = features.includes('near-miss-tease')` (`:67`) and `bonusBuyCost` (`:71-73`). Everything else is ignored, so presentation is **global and identical for every generated game**, decided by hardcoded runtime code. A grep of the dev `src/` for `chainwtf`, `presentationTuning`, `waysImmersive`, `tierArt` returns **zero** — you have no importer for our schema.

## B1 — Win marquee (procedural; needs an art consumer)
- **Symptom:** generic "basic generator yellow" plaque with hardcoded `BIG WIN!` / `MEGA WIN!` text instead of our neon Vice tier art.
- **Root cause:** the marquee is drawn **100% procedurally**. `buildWinBanner()` (`src/game/PixiApp.ts:1060-1116`) is all `Graphics` draw calls; the yellow is one constant `const gold = this.winBannerColorOverride ?? 0xFFD23F;` (`PixiApp.ts:1068`). The label is hardcoded: `const label = isMegaPlus ? 'MEGA WIN!' : isBigPlus ? 'BIG WIN!' : '';` (`PixiApp.ts:1132`). No `Sprite`/`Texture`/PNG is ever used.
- **Only knob is a single accent color** (`winBannerColorOverride`, set from chat param `winBannerColor` → `ACCENT_PRESETS`, `PixiApp.ts:1347-1350`, `adjustableParams.ts:35-43`) — no vice/neon option, and it only recolors the procedural plaque. **Do NOT treat `winBannerColor` as a workaround.**
- **Schema gap:** `GameTheme` (`src/engine/GameConfig.ts:49-99`) has no `winMarquee`/`tierArt`/`marqueeStyle` field. Note even the existing `theme.winBanner` token is unused by the marquee (only consumed as a CSS glow in `src/ui/generator/PixiPreviewPanel.tsx:178`).
- **Our preset already carries everything** (in a vocabulary you don't parse): mechanic `win-marquees` (preset lines 3366-3382); `assets.winTiers` (preset lines 3620-3630, `dir:"theme/win-tiers/"`, layers `big/mega/epic/max/win/plate`); and the load-bearing block **`extras.presentationTuning.marquee.tierArt`** (preset lines 4085-4092) mapping each tier to `theme/win-tiers/<tier>.png` + bands (`minBigWin:15`, `mega:25`, `epic:100`) + geometry (preset lines 4041-4104).
- **Concrete dev fix (two coupled changes):**
  1. Add an art field to `GameTheme` (`src/engine/GameConfig.ts`, after `winBanner` ~:57):
     ```ts
     winMarquee?: {
       tierArt: Partial<Record<'win'|'big'|'mega'|'epic'|'max'|'plate', Texture>>;
       bands?: { minBigWin: number; mega: number; epic: number };
       tierScale?: number[];
     };
     ```
     Populate it in the preset-importer from `preset.extras.presentationTuning.marquee.tierArt` (explicit per-tier file map + bands/geometry — **wire this one**, not `assets.winTiers` which is just the bundling manifest).
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
- **Root cause:** there is **no intro/boot/iris system** in the engine. `grep intro|boot|splash|iris` across the dev runtime (`App.tsx`, `PixiApp.ts`, `useGameState.ts`, `GameCanvas.tsx`) returns nothing. `src/App.tsx:14-60` mounts `GameCanvas` straight to the base reels. The only "transition" is `PixiApp.playTransitionCard()` (`PixiApp.ts:985`, called :849/:912) — a FS-entry/total dim-plaque, not a boot→game transition. `transitionAnimations.ts`'s only intro-ish entry `base-to-fs-intro` (:28-37) is `implemented:false` and FS-scoped. Background is a procedural gradient from theme colors (`PixiApp.ts:287-330, 517-534`); a real bg image can only come via `setBackgroundImage(dataUrl)` (`PixiApp.ts:683-723`), a **wizard-only** upload path — not a deploy/preset channel and not in `GameConfig`.
- **Our preset fully specifies the intro** (all unread): `flow.iris.style="looney-iris"` (preset :3697-3699); `flow.stages[]` `boot`/`game-intro` with `transitionOut:"iris-from-black"` (:3701-3712), `fs-intro` with `transitionIn:"iris"` (:3729-3731); `assets.introLayers` → `data/introLayers.json` + `theme/vice/intro/` (:3631-3634); `extras.layout.introScreens` (18-layer game intro + fs3/fs4/outro, :4249-4255) + `bootScreen` (:4256-4265) + `background.fsIntroImage` (:4233).
- **Concrete dev fix (minimum):** add a `boot → game-intro → base` phase that (1) reads `flow.stages`, (2) renders `assets.introLayers` (manifest `data/introLayers.json`, dir `theme/vice/intro/`) over the `bootScreen` gradient, (3) plays `transitionOut = "iris-from-black"` before revealing the base reels. Make `flow.iris:"looney-iris"` a real `implemented:true` transition. If a full intro is out of scope for Thursday, the smallest acceptable fix is a boot→base **crossfade** honoring `transitionOut`, so the game stops hard-cutting into the reels.

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

The dev's rules/info screen needs Vice-specific content. **WE supply the copy/values** (see `VICE_HEAT_OUR_SIDE_FIXES.md` for the authoritative source). Required content:
- **Paytable:** wild/highA…lowG symbol pays + `scatterPay [768, 1490, 4471]` (3/4/5 scatters), from `math.manifest.payTable` / `scatterPay`.
- **Ways count:** 5×5 ways-pays, left-to-right, `MIN_MATCHING_REELS 3` → **3125 ways**. Ensure the compiled contract is 5×5 (3125 ways), **not** the engine default 5×3/243.
- **RTP: 95.99%** (certified; note contract `RTP_BPS` compiles to 9600 unless D10 fixed).
- **Max win: 5000×** (`maxWinMultiplier 5000`, matches dev hard cap).
- **Feature descriptions:** tiered free spins (3sc→7 spins / 4sc→10 spins), expanding wilds in FS, sticky expanding towers, hot spins, staged bonus buys (100×/200×), ante bet (3.25× for 3× FS chance).

Cross-reference: the paytable/feature copy is maintained on our side and delivered with the preset — coordinate on the exact strings before wiring the info modal (the dev's Recent-Bets fairness modal exists, but no paytable modal is currently wired — `winPresentation`/UI notes above).

---

# PRIORITIZED FIX ORDER

1. **D8 — verify the ingestion object first** (could be the whole story; ~5 min). Confirm `preset.math.manifest` (not `preset`/`preset.math`) reaches `configFromMathProfile`.
2. **D11 — the ways-evaluator wild-on-reel-0 bug** (a ~10-line change in `_evaluateWins`, client + contract). It underpays on ~12.5% of base spins and on effectively every expanded free spin, and it is in YOUR engine today regardless of anything else on this list. Cheap to fix, and it invalidates any RTP figure measured before it.
3. **D1 + D2 — expanding wilds + sticky/simul/full-house FS** (restores ~65% of RTP). Reference: `src/dev/mockHost.ts:407-548` reads the exact `custom{}` keys the preset already ships.
4. **D3, D4 — staged buys + ante** (only if those buttons ship at launch).
5. **Section D layout** — switch to bottom bar + tuned onResize + left-rail logo (biggest visible fix after RTP).
6. **B1/B2 marquee + ways-immersive; B4 intro** — presentation richness.
7. **D6 retrigger amount, D7 hot-spins; C audio dev-side keys** — correctness/feel.
8. **D9, D10, D5-note; B3 FS counters (after our asset delivery)** — cleanup.
