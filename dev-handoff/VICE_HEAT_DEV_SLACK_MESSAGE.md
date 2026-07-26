# Vice Heat — Slack message for the dev (copy-paste)

*(Attach the updated `vice-heat.chainwtf-preset.json` + the zip.)*

---

Hey — updated **Vice Heat** preset is in (`vice-heat.chainwtf-preset.json`, schema v2, exported 2026-07-26). We went through our whole repo and split everything into: what **we already fixed** in the preset, and what **you still need to change** engine-side. Full detail with file:line on both sides is in `VICE_HEAT_FIXES_FOR_DEV.md` in the zip — short version below.

**⚠️ Check this FIRST (5 min — could be half the issue)**
Confirm you feed `preset.math.manifest` (NOT `preset` or `preset.math`) into `configFromMathProfile` / `buildGameConfigFromMathProfile`. If not, `reelStrips` is `undefined` → silent fallback to the Fantasy 5×3 default. (We also flattened those fields onto the preset root as a safety net.)

**The core problem**
The generator ingests Vice as **math-only + theme art** — it silently drops our `math.manifest.custom{}` block *and* all presentation config, and draws the marquee / win-lines / FS-counters / intro / sounds from its own registries. So Vice runs as a plain 3125-ways game with generic presentation. Net effect: **~65% of the RTP is missing** (the whole expanding-wild free-spins engine lives in `custom{}`), and the look + sound are the generic defaults.

**MATH — things changed here, you need ALL of it:**
- RTP **95.99%** (9599 bps). `reelStrips` (5 strips), payTable, scatterPay — all in `manifest`.
- `custom{}` block (your engine currently drops this — a working reference impl is in your own repo at `src/dev/mockHost.ts`, it reads the exact same keys):
  - **Expanding wilds in free spins ← this is the ~65% RTP**
  - Sticky towers + simultaneous-expand multipliers (**×2 / ×10**) + full-house **×2**
  - Staged bonus buys: 3-scatter = **100× bet**, 4-scatter = **200× bet** (read verbatim from `costMult`)
  - Ante bet **3.25×** (~3× free-spins chance)
  - Hot-spins base feature
  - Retrigger = **+3** spins

**Points that were WRONG before (so you know what to look for):**
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
