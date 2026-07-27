# Vice Heat — Slack message for the dev (copy-paste)

*(Attach the updated `vice-heat.chainwtf-preset.json` + the zip.)*

---

Hey — updated **Vice Heat** preset is in (`vice-heat.chainwtf-preset.json`, schema v2, exported 2026-07-27). We went through our whole repo and split everything into: what **we already fixed** in the preset, and what **you still need to change** engine-side. Full detail with file:line on both sides is in `VICE_HEAT_FIXES_FOR_DEV.md` in the zip — short version below.

**✅ FINAL NUMBERS IN THIS DROP** (everything re-measured against a runtime-faithful simulator, ~45M rounds, zero max-win-cap violations):

| mode | cost | certified RTP |
|---|---|---|
| natural | 1× | **95.91%** ±1.14 |
| buy 3-scatter | 100× | **95.93%** ±1.04 |
| buy 4-scatter | 200× | **96.11%** ±1.20 |
| ante | 3.25× | **96.40%** ±1.35 |

Prices unchanged (100× / 200× / 3.25×). `payTable` and `scatterPay` unchanged too — the rebalance rode on the strips, which are all in the preset. **`rtpBps` is now 9591** and `expectedMetrics.rtpPct` matches it. Three things also changed on our side: `simulExpandMultipliers` is **deleted** (top-level *and* the buy3 override — don't implement a simul ladder), **hot spins are implemented** for the first time (they were advertised but never built; the ante depends on them), and the buy/ante strips were **re-fitted** (buy3 had been paying 8.9% of its price, buy4 122%).

**NEW in this drop — the free spins were re-certified.** The FS now rolls its own rare-wild strips (`fsReelStrips`), **5 full wild reels = instant 5000× max win** in both bonuses (`custom.fullBoardInstantMaxWin`), 3sc = per-spin expansion / 4sc = sticky towers to cap 5, and the old sticky ×2/×10 + full-house doubling is retired. New `payTable.wild [1243,2034,3616]` / `scatterPay [1164,2260,6780]`. See the ⚠️ display-strips note below — it bit us and it'll bite the engine the same way.

**🔴 We found a PAYOUT bug that is in YOUR engine too — byte-identical (`D11` in the doc)**
`_evaluateWins` picks which symbols to test by looking at **column 0 only**, and turns a WILD sitting there into HIGH_A:
```ts
const effectiveSym = sym === SymbolId.WILD ? SymbolId.HIGH_A : sym;   // <-- here
```
A wild substitutes for *everything*, so a wild in column 0 should let every symbol pay. Folding it into HIGH_A means a **full wild reel 0 can pay at most ONE combination**. Real board from our build — towers on reels 1/2/4: engine paid 45.20× (shades guy only), correct is 153.96× (+ J with 500 ways, + K, + briefcase). **The player got 29.4% of what he was owed.** Measured blast radius: ~12.5% of base spins and effectively every expanded free spin; Vice's base ways component alone goes 47.15% → 52.74%.
Fix = iterate every paying symbol in the paytable instead of seeding from column 0; leave the rest of the function alone (the counting loop already substitutes wilds correctly). Same change in `SlotGame.sol:_evaluateWins`. We verified on 548,631 boards without a wild in column 0 that the corrected model is **identical** — it cannot regress a normal ways game.
**Any RTP number either of us measured before this fix is void.** We're re-fitting the paytable now and the updated preset will carry re-certified `payTable`/`scatterPay` — please take those, don't keep the old numbers with a corrected evaluator.

**⚠️ Check this FIRST (5 min — could be half the issue)**
Confirm you feed `preset.math.manifest` (NOT `preset` or `preset.math`) into `configFromMathProfile` / `buildGameConfigFromMathProfile`. If not, `reelStrips` is `undefined` → silent fallback to the Fantasy 5×3 default. (We also flattened those fields onto the preset root as a safety net.)

**The core problem**
The generator ingests Vice as **math-only + theme art** — it silently drops our `math.manifest.custom{}` block *and* all presentation config, and draws the marquee / win-lines / FS-counters / intro / sounds from its own registries. So Vice runs as a plain 3125-ways game with generic presentation. Net effect: **~65% of the RTP is missing** (the whole expanding-wild free-spins engine lives in `custom{}`), and the look + sound are the generic defaults.

**MATH — things changed here, you need ALL of it:**
- RTP **95.99%** (9599 bps). `reelStrips` (5 strips), payTable, scatterPay — all in `manifest`.
- `custom{}` block (your engine currently drops this — a working reference impl is in your own repo at `src/dev/mockHost.ts`, it reads the exact same keys):
  - **Expanding wilds in free spins ← this is the ~65% RTP**
  - **FS rolls its OWN rare-wild strips `fsReelStrips`** (5×120-stop, 1 wild/reel = 3× rarer than base) — display MUST roll these too (⚠️ below)
  - **5 full wild reels = INSTANT MAX WIN 5000×** in both bonuses (`custom.fullBoardInstantMaxWin`); 1–4 wilds pay natural ways
  - Sticky towers to **cap 5** (4sc, 10 spins) / per-spin expansion (3sc, 7 spins). Old ×2/×10 simul + full-house ×2 doubling is **RETIRED** (max win = the 5-tower/5-simul jackpot; certified 4sc max-win 0.74% only at 4–5 towers, 3sc ~1-in-333k/bonus)
  - Staged bonus buys: 3-scatter = **100× bet**, 4-scatter = **200× bet** (read verbatim from `costMult`)
  - Ante bet **3.25×** (~3× free-spins chance)
  - Hot-spins base feature
  - Retrigger = **+3** spins

**Points that were WRONG before (so you know what to look for):**
- ⚠️ **FS display strips must mirror settlement.** In our own build the FS wild expanded on screen but "didn't connect with Q/J" — because the display was rolling the **base** strips while settlement evaluated `fsReelStrips`, so the shown board ≠ the paid board. **Rule: whatever strips the FS settlement evaluates, the display reels must roll the same.** If your engine draws FS visuals off base strips but settles on `fsReelStrips`, you'll hit this exact bug.
- Buy-4 card showed **300×** → correct is **200×** (read from `costMult`, don't hardcode)
- Retrigger added **+7** → correct is **+3**
- FS counter + total-win = bottom text on your side → we ship neon **FREE SPINS + TOTAL WIN** plaques
- Win marquee = procedural gold "BIG WIN!" → needs our tier art (`extras.presentationTuning.marquee.tierArt`)
- Wins played **no sound** (`connect-symbol` was silent) + `win-screen-music` silent

**AUDIO — Noski's FINAL mix is baked into the preset (12 events, his exact levels).**
- Shipped FLAT as `/audio/<id>.ogg` (your flat key contract): ambient-music, win-screen-music, connect-symbol, coin-chime, spin-start, reel-stop, scatter-land, free-spin-trigger (+ win-small/normal/big/mega at 0 = off).
- **Heads-up:** his mix ALSO uses `fs-retrigger`, `tease-riser`, `tease-miss`, `wild-land`, `wild-expand`. **Your runtime never dispatches these events**, so they're silent in your build (they play on our Vercel). If you want them, fire those events. `win-screen-music` + `connect-symbol` must not be silent.

**SIZING** (all in `preset.extras.sizing.machineBox`):
- Design box **688×708** (aspect 0.972), 5×5 grid **632×580**. Bottom control bar = **12.5%** of box width; the ways grid keeps a `height×0.12` bottom reserve so its bottom row clears the bar.
- Keep the grid **CENTRED horizontally** — do NOT let the right-hand palm/marquee overhang push it left (palm may clip at the right edge). That leaves a LEFT letterbox where the **VICE HEAT logo** sits centred, **bonus-buy button symmetric under it**. Your implemented control is the left sidebar; production skin needs the **bottom bar**.

**Two asks from us:**
1. Can you **send your actual control-bar source files**? Ours is a 1:1 rebuild of the chaingames-complete package — we want to drop your real components in so it's byte-identical to what ships, not a rebuild.
2. **Can your engine be adapted** to consume our `custom{}` math + presentation config + the extra audio-event dispatches? Or is there a hard constraint we should design around instead?

Rules / paytable text for the info screen is in `VICE_HEAT_RULES_CONTENT.md`. The finished Vice is live on our Vercel (**generatorpr.vercel.app**) — that's the target look/sound, always kept up to date. Shout if anything's unclear — happy to jump on a call.
