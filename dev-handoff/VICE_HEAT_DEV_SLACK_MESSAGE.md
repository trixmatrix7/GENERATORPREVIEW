# Vice Heat — Slack message for the dev (copy-paste)

*(Attach the updated `vice-heat.chainwtf-preset.json` + the zip.)*

---

Hey — updated **Vice Heat** preset is in (`vice-heat.chainwtf-preset.json`, schema v2, exported 2026-07-28). Full detail with file:line on both sides is in `VICE_HEAT_FIXES_FOR_DEV.md` in the zip — short version below.

**🙏 FIRST, A CORRECTION — please throw away the "D11 evaluator bug" from our last message.**
We told you `_evaluateWins` was under-paying because it seeds its candidate symbols from column 0 and folds a WILD there into HIGH_A, and we asked you to change it in the client **and in `SlotGame.sol`**. **That was our mistake — the behaviour is correct and it is the spec.** A fully wild reel 0 is meant to score as one combination at the wild/HIGH_A rate. Our design-model simulator disagreed with the contract, and we trusted the simulator instead of the chain. When we shipped our "corrected" evaluator, every symbol on the board started connecting with every other symbol — highs with lows, all at once — and Noski spotted it within a spin. **Please don't make that change; revert it if you started.** Leave `WinEvaluator.ts` and `SlotGame.sol:341` exactly as they are. Every RTP number from our previous drop (95.91 / 95.93 / 96.11 / 96.40) was measured against that broken evaluator and is **void**.

**✅ RE-CERTIFIED NUMBERS** — measured against the **contract's** rule set by a harness that drives our live round core, i.e. literally what the game pays. Zero max-win-cap violations in every run.

| mode | cost | certified RTP | rounds |
|---|---|---|---|
| natural | 1× | **96.46%** ±1.59 | 20,000,000 |
| buy 3-scatter | 100× | **96.35%** ±0.97 | 500,000 |
| buy 4-scatter | 200× | **96.08%** ±0.39 | 4,000,000 |
| ante | 3.25× | see `simResults.ante` in the preset | — |

Prices unchanged (100× / 200× / 3.25×). `payTable` and `scatterPay` unchanged. **`rtpBps` is 9670.** Natural RTP splits as base 47.9% · hot spins 3.8% · FS-3sc 14.2% · FS-4sc 30.7%.

**🆕 The RTP came back through a MECHANIC, not the evaluator — two new things to port:**

**1. TOWER MULTIPLIERS ×1–×5 (`D12`).** Every reel standing **fully wild** during a free spin is dealt a badge, drawn from `custom.towerMultiplierWeights` `[55,20,9,6,10]`. A winning combination pays × the **HIGHEST badge it crosses**. Not a product (we measured a product model at 187% RTP on the 4-scatter buy), not a sum. Scatter pay is never multiplied, nothing stacks on the 5-wild instant max win, sticky towers keep their badge for the round, and hot spins carry no badge. **Draw the badges from a reserved seed namespace** (we use `1n << 200n`) so the badge roll doesn't consume words from the reel-stop stream — otherwise every stop shifts and the certification is void. A ×5 reaches the board in 0.22% of natural rounds.

**2. GUARANTEED TOWER on the 4-scatter buy (`D13`).** `viceBuyStages` now carries `guaranteedTowerOnFirstSpin`. If the first free spin of a **bought** 4-scatter round would land with no fully-wild reel, that reel advances to the next stop whose window holds a wild. Before this, **15.5% of bought rounds (1 in 6.4) showed the player no tower at all** — on a buy sold as "10 sticky tower spins". Now 0%; mean 2.03 towers at round end. Bought rounds only, never a natural or ante trigger. Price unchanged.

**⚠️ Check this FIRST (5 min — could be half the issue)**
Confirm you feed `preset.math.manifest` (NOT `preset` or `preset.math`) into `configFromMathProfile` / `buildGameConfigFromMathProfile`. If not, `reelStrips` is `undefined` → silent fallback to the Fantasy 5×3 default. (We also flattened those fields onto the preset root as a safety net.)

**The core problem (unchanged)**
The generator ingests Vice as **math-only + theme art** — it silently drops our `math.manifest.custom{}` block *and* all presentation config, and draws the marquee / win-lines / FS-counters / intro / sounds from its own registries. So Vice runs as a plain 3125-ways game with generic presentation, and the whole expanding-wild free-spins engine — where most of the RTP lives — never runs.

**MATH — you need ALL of `custom{}`** (a working reference impl is in your own repo at `src/dev/mockHost.ts`; it reads these exact keys):
- **Expanding wilds in free spins** ← the bulk of the RTP
- **Tower multipliers ×1–×5** (new, above) and the **4-scatter tower guarantee** (new, above)
- **FS rolls its OWN rare-wild strips `fsReelStrips`** — display MUST roll these too (⚠️ below)
- **5 full wild reels = INSTANT MAX WIN 5000×** in both bonuses (`custom.fullBoardInstantMaxWin`); 1–4 wilds pay natural ways
- Sticky towers to **cap 5** (4sc, 10 spins) / per-spin expansion (3sc, 7 spins). `simulExpandMultipliers` is **deleted** — do not implement a simul ladder
- Staged bonus buys: 3-scatter = **100× bet**, 4-scatter = **200× bet** (read verbatim from `costMult`)
- Ante bet **3.25×**; **hot spins** (`custom.hotSpinChance1In` 80) fire on natural and ante base spins and **never on a bought round** — the ante depends on them
- Retrigger = **+3** spins

**Traps that already bit us — you'll hit them the same way:**
- ⚠️ **FS display strips must mirror settlement.** Our FS wild expanded on screen but "didn't connect with Q/J", because the display rolled the **base** strips while settlement evaluated `fsReelStrips`. **Whatever strips the settlement evaluates, the display must roll.**
- ⚠️ **Swap `reelLengths` together with the strips.** We shipped a bought round where they desynced: the display rolled 1170-stop strips while settlement used the stage's 405-stop set, so wins highlighted the wrong cells.
- ⚠️ **Max-win test must be exact integer arithmetic.** Compare `winAmount >= maxWinMultiplier × wager` in BigInt — a float comparison can skip the cap ceremony, and on a real platform a skipped or mis-sized max win is an exploit.
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

**EXPANDED-WILD LOOK — now exposed as settings** (`extras.visualParams`, so you don't have to hardcode them like we did):
`expandWildBackdrop` / `expandWildBackdropAlpha` (the panel behind the tower), `expandWildBorder` / `expandWildBorderWidth` / `expandWildBorderAlpha` (border around the wild reel — width 0 = off, which is the shipped look), and `expandWildMultiPop` / `expandWildMultiPopTime` (how hard the ×N badge punches on when it locks). The multiplier badge art is a 5-frame strip (`wild_multi_sheet.webp`, ×1…×5) seated in the lower third of the column so it clears the "WILD" lettering on the board.

**Two asks from us:**
1. Can you **send your actual control-bar source files**? Ours is a 1:1 rebuild of the chaingames-complete package — we want to drop your real components in so it's byte-identical to what ships, not a rebuild.
2. **Can your engine be adapted** to consume our `custom{}` math + presentation config + the extra audio-event dispatches? Or is there a hard constraint we should design around instead?

Rules / paytable text for the info screen is in `VICE_HEAT_RULES_CONTENT.md`. The finished Vice is live on our Vercel (**generatorpr.vercel.app**) — that's the target look/sound, always kept up to date. Shout if anything's unclear — happy to jump on a call.
