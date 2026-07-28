# Vice Heat — dev handoff package

Everything the generator needs to **rebuild this slot** — cleaned, documented,
and split into universal, addable features. Vice Heat is the reference skin;
every **feature** and **flow** here is theme-agnostic and works in any game.

> Built from the live studio (https://generatorpr.vercel.app). Old/unused files
> (dropped dancers, superseded backgrounds, legacy sheets) are removed. All
> audio is **OGG** — no wav/mp3. No video — every animation is a **spritesheet**.

## What's in the box

```
dev-handoff/
├─ README.md                 ← you are here (master index)
├─ CONFORMANCE.md            ← ⭐ READ FIRST — the deny-by-default contract: which
│                               engine defaults must be switched OFF, and the
│                               acceptance checklist to run against your build
├─ preset/
│  └─ vice-heat.chainwtf-preset.json ← the one declarative file the generator
│                               loads, and the single source of truth for math
├─ PRESET_FORMAT.md          ← the v2 preset schema, key by key
├─ FLOW.md                   ← the full presentation pipeline + every transition
├─ ASSET_SPECS.md            ← spritesheet/symbol dimensions, 5x5 vs 5x3, auto-crop
├─ MANIFEST.txt              ← file inventory of this package
├─ VICE_HEAT_DEV_SLACK_MESSAGE.md ← the short cover note (copy-paste)
├─ VICE_HEAT_FIXES_FOR_DEV.md     ← the long file:line diff list, both sides
├─ VICE_HEAT_OUR_SIDE_FIXES.md    ← what we fixed on our side before exporting
├─ VICE_HEAT_RULES_CONTENT.md     ← player-facing rules/paytable copy
├─ features/                 ← each feature = self-contained, universal, addable
│  ├─ README.md              ← feature index (17 packages, 2 kinds)
│  │  ── behaviour + asset (README + feature.json) ──
│  ├─ boot-loader/           ← ⚠️ CHAIN GAMES loading screen — STAGE 1, universal,
│  │                            and absent from the dev build today
│  ├─ expanding-wild/        ← "add one image" wild-reel expansion
│  ├─ expanding-sticky-wild/ ← the sticky variant (towers persist the round, cap 5)
│  ├─ tower-multipliers/     ← ×1–×5 badge per full wild reel (carries the FS RTP)
│  ├─ hot-spins/             ← 1-in-80 base spin runs hot (carries the ante)
│  ├─ win-marquees/          ← tiered win celebration (universal, + music)
│  ├─ coin-rain/             ← coin-rain overlay
│  ├─ tease-camera/          ← POV-dolly anticipation
│  ├─ frame-win-flash/       ← frame lights up on trigger
│  ├─ symbol-sheets/         ← per-symbol idle + win spritesheets
│  ├─ paylines/              ← lines pay-model (Crack Farm; README only)
│  │  ── drop-in code modules (real .ts + integration) ──
│  ├─ round-core/            ← ⭐ viceSpin.ts: the pure seed-derived round core
│  │                            (settlement + display + simulator all call it)
│  ├─ win-line/              ← ways-light comet (WaysLightComet.ts, 1:1)
│  ├─ frame/                 ← procedural neon frame band (no-image fallback)
│  ├─ cell-backdrop/         ← per-cell backing panels
│  ├─ reel-background/       ← reel-window tint/wash
│  ├─ fs-background/         ← free-spins background swap
│  └─ vice-bonus-buy-ante.md ← the buy stages + ante bet, written up
├─ flow/
│  └─ intro-screens/         ← custom intro/outro screens (game/fs3/fs4/outro)
├─ math/                     ← verification tooling — NOT a second source of truth
│  ├─ RTP_VERIFICATION.md    ← ⭐ the CURRENT certification table + how to reproduce it
│  ├─ sim_vice_core.mjs      ← ⭐ the certifying harness: esbuild-bundles the round
│  │                            core (src/game/viceSpin.ts — byte-identical to the
│  │                            copy in features/round-core/) and runs it for
│  │                            millions of rounds against src/data/math_vice_heat.json
│  ├─ sim_vice.mjs           ← older INDEPENDENT re-implementation (second opinion
│  │                            on the base game only — no tower multipliers,
│  │                            carries the retracted --eval=corrected flag).
│  │                            ⛔ do not certify against it
│  ├─ MATH_MODEL.md          ← design-model narrative (under revision — where it
│  │                            disagrees with the preset, the preset wins)
│  ├─ simulate_vice_heat.py / simulate_vice_heat_v2.py / sims/ ← historical
│  │                            calibration passes, kept for provenance
│  └─ vice_heat_expanding.json ← stand-alone COPY of the manifest for tooling that
│                               cannot read the preset. Not byte-identical to
│                               preset.math.manifest — ingest the preset, not this
└─ assets/                   ← drop into the generator's public/
   ├─ audio/                 ← *.ogg + sound-pack README
   ├─ introLayers.json       ← intro-screen layer layout
   └─ theme/{vice,win-tiers}/← spritesheets, symbols, frame, backgrounds, intros
```

> **If you read one file before writing code, read `CONFORMANCE.md`.** Every other
> document here says what to *add*; that one says what must **not** be there. The
> last build failed less because our features were missing than because the
> engine quietly substituted its own defaults in their place — a substituted
> default in the *math* path does not even look wrong, it just pays differently.

## How the generator consumes this

1. **Assets:** copy `assets/audio/*` → `public/audio/`, `assets/theme/*` →
   `public/theme/`. Every path in the preset + docs is already public-relative.
2. **Preset:** load `preset/vice-heat.chainwtf-preset.json`. It wires the grid,
   math manifest, every asset (with sheet geometry), the audio map, the feature
   list, and the flow — the same shape the studio's "Export Build" emits.
3. **Math — one source of truth: `preset.math.manifest`.** Feed *that node* (not
   `preset`, not `preset.math`) into `configFromMathProfile` /
   `buildGameConfigFromMathProfile`. If `reelStrips` comes back `undefined` the
   engine silently falls back to the Fantasy 5×3 default and the game pays
   something else entirely while looking normal — make that fallback **throw**
   (`CONFORMANCE.md` §1 item 11). The same fields are also flattened onto the
   preset **root** as a documented fallback for flat readers; they are copies,
   not a second source of truth.
   - `math/vice_heat_expanding.json` is a **third stand-alone copy** for tooling
     that cannot read the preset. It is *not* byte-identical — it is missing the
     two `viceBuyStages[].label` strings and `expectedMetrics`. If the two ever
     disagree, `preset.math.manifest` wins.
   - `math/MATH_MODEL.md` is the older **design-model narrative** and is being
     revised; do not implement settlement from it.
4. **Settlement:** port `features/round-core/viceSpin.ts`. It is the pure,
   seed-derived function that turns `(randomness, bet, config, stage)` into a
   whole round — board, expansions, sticky towers, ×1–×5 tower badges, free
   spins, credited total — and our settlement, our display and the certifying
   simulator all call **that same function with the same seed**. That is what
   makes a display/payout mismatch structurally impossible (we shipped a round
   whose plaque said 32 and credited 42, back when they were two
   implementations). It also carries the two rules you cannot get wrong: the
   **reserved seed namespaces** (badges drawn from `keccak(seed, 1 << 200)` so
   the reel-stop stream is untouched) and the **exact BigInt max-win test**.
   Read `features/round-core/README.md` first.
5. **Verify:** `math/RTP_VERIFICATION.md` has the current certification table and
   the reproduction commands. The one-number check against your own port:
   `node math/sim_vice_core.mjs 20000000 --mode=natural --seed=4242424` → expect
   **96.46%** ±1.59pp. Landing near 72% means the free-spins mechanics are not
   running; landing near a third of target means `custom{}` is being dropped.
   (The harness resolves the core at `src/game/viceSpin.ts` and its manifest at
   `src/data/math_vice_heat.json` relative to the repo root — point those two at
   your port. Buy modes run `rounds/4`, since a bought round replays a whole
   bonus: ask for 2M and you measure 500k. Size runs off the per-round spread,
   not off habit — the ante's std is ~20× stake, so 4M rounds buy only ±2.54pp.)
6. **Features & flow:** each `features/<x>/` is independent — turn it on/off in
   the preset's `features` block. `FLOW.md` is the ordered pipeline; each stage
   (boot → intro → base → tease → FS intro → FS → win marquees → outro) is
   addable/removable and says whether the control bar is visible.
7. **Conform:** walk `CONFORMANCE.md` §4 against the running build. Every row
   needs both halves — ours present *and* the engine's default absent.

## The game at a glance

- **5×5, 3125 ways**, all symbols pay from 3-of-a-kind. Alt grid **5×3**.
- **Certified 96.46%** natural RTP (±1.59pp / 20M rounds), hit frequency
  **68.24%**, hard **5000×** max-win cap. `rtpBps` **9670** is the operative
  number; `targetRtpPct` is display metadata only. Pay floor **0.1164×**
  (1164 bps — the smallest connection, and the scatter-3 pay). Buys 100× / 200×,
  ante 3.25×. Full table in `math/RTP_VERIFICATION.md`.
- **Tiered free spins:** 3 scatters = **7** spins (per-spin expanding wilds);
  4 scatters = **10** sticky spins (towers persist, cap **5**). Retrigger **+3**.
- **Tower multipliers ×1–×5:** every reel standing fully wild in a free spin is
  dealt a badge (`custom.towerMultiplierWeights` `[55,20,9,6,10]`); a
  combination pays × the **HIGHEST** badge it crosses — not the product, not the
  sum. **This is where the free-spins RTP lives**: without it the bonus pays a
  71.6% floor. See `features/tower-multipliers/`.
- **Hot spins:** 1-in-80 base spins (natural and ante) expand every reel holding
  a wild; no multiplier, never on a bought round. See `features/hot-spins/`.
- **Max win has exactly two routes:** (a) **5 fully wild reels = FULL BOARD**,
  which pays exactly `maxWinMultiplier × bet` **instantly** and ends the round
  (`custom.fullBoardInstantMaxWin`) — in both bonuses, and in the base game when
  all 5 reels go hot, with nothing multiplied on top; (b) the running-total cap
  at `maxWinMultiplier × wager`. 1–4 wild reels pay natural ways.
- **Presentation:** living intro screens, POV-dolly tease, per-cell scatter win,
  frame flash, iris transitions, tiered win marquees with theme-neutral music,
  a count-up TOTAL WIN outro. All spritesheet-driven, mobile-playable.

> ### ⛔ Superseded — do not re-derive
> Earlier drops of this README described the max win as *"the 3-scatter simul-×10
> spike"*, quoted a **0.077× / 768 bps** pay floor, a **69.3%** hit rate and a
> flat *"~96%"*. All four are **void**, and so are the RTP figures 95.99 / 95.91 /
> 95.93 / 96.11 / 96.40 / 95.52 wherever they still appear in an old file.
> * `custom.simulExpandMultipliers` — the simultaneous-expansion multiplier
>   ladder — is **DELETED**. It is not in the preset. Build a simul ladder and
>   you ship a game that pays nothing like the certified one, with a max-win
>   route that does not exist.
> * The full-house / `stickyFullBoardMultiplier` ×2 doubling is **OFF** (the
>   field is present and set to `1`).
> * Tower caps of **3 or 4** are superseded — the cap is **5**
>   (`custom.stickyTowerCap`, and both `viceBuyStages` carry `stickyTowerCap: 5`).
> * The **"D11" ways-evaluator fix is RETRACTED.** A column-0 wild folding to
>   `HIGH_A` is the **spec** — `SlotGame.sol:341` does exactly that. Nothing in
>   `WinEvaluator.ts` or `SlotGame.sol` should change; every number measured
>   against the "corrected" evaluator is void.

## Still iterated in the studio

Per Noski: the **custom intro screens** and **spritesheets** keep being refined
in the studio — the current versions are included here as the Vice Heat preset
so they auto-load, and `ASSET_SPECS.md` + `flow/intro-screens/` document the
format so updated art drops straight in.
