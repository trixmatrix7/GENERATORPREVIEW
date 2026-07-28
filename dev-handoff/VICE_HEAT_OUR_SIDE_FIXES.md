# Vice Heat — OUR-Side Fixes (Studio / Export / Preset)

Scope: **only** what our team changes in the studio, the exporter, and the preset. Everything engine-side is in `VICE_HEAT_FIXES_FOR_DEV.md`. Do **not** edit dev code from here.

Preset: `dev-handoff/preset/vice-heat.chainwtf-preset.json` · Exporter: `src/studio/exportPresetV2Core.ts` · Tuning JSON: `src/data/vicePresentationTuning.json` · Runtime truth: `src/App.tsx`, `src/game/PixiApp.ts`.

> ### RE-VERIFIED 2026-07-28 against the shipped export
> This doc was written **2026-07-26** and was never re-run against the current preset
> (`exportedAt: 2026-07-28T04:25:57.981Z`, preset line 8). Several items below were closed by that
> re-export; **§2 and §6 quoted an RTP that is retired.** Every section now carries a **STATUS**
> line, and superseded text is kept under a `HISTORY` banner so nobody re-derives it. **Nothing
> under a HISTORY banner is a build instruction.**
>
> **Certified numbers** — `math.manifest.simResults` (preset :20107-20211), tool
> `custom-math/sim_vice_core.mjs`, which drives the live round core `src/game/viceSpin.ts`:
> natural **96.46% ±1.59pp / 20,000,000 rounds** (confirmed 96.94% ±2.95pp / 6M on a separate seed) ·
> buy3 **96.20% ±0.49pp** · buy4 **95.97% ±0.56pp** (independent simulator, 4M) ·
> ante **96.00% ±1.16pp / 20,000,000**. Zero max-win-cap violations on every row, and zero invariant
> violations (`simResults.invariants`, :20205).
> Operative field: **`rtpBps 9670`** (preset :32; `extras.rtpNote` :53288 —
> "rtpBps is the operative certified RTP; targetRtpPct is display metadata only").
>
> **`95.99` / `9599` is VOID.** It predates the tower multipliers and describes a game we do not
> ship. So are `95.91`, `95.93`, `96.11`, `96.40`, `95.52`, `94.3`, `71.8`, and the
> `scatterPay [768,1490,4471]` row. Do not copy any of them into an implementation or an export.

---

## 1. D8 — Export flattening (belt-and-braces so ingestion cannot silently fall back)

**Problem:** our exporter nests all payout-relevant math under `preset.math.manifest`. The dev's loaders (`buildGameConfig.ts:40-43`, `simulator.ts:487-491`, `assembler.ts:32,66-76`) read `reelStrips` etc. at the **profile root**; if they pass `preset` or `preset.math`, `reelStrips` is `undefined` → silent Fantasy 5×3 fallback.

**Our export code that nests it:** `src/studio/exportPresetV2Core.ts:453-455`:
```ts
math: manifest
  ? { mode: 'inline', manifest }
  : { mode: 'inline', manifest: { gridId, reelStrips: [], payTable: {}, scatterPay: [0,0,0], ... } },
```
(`manifest` is built at `:435` via `normalizeManifest(i.game, i.manifest)`.)

**Fix:** in `exportPresetV2Core.ts` around `:453`, ALSO emit the manifest's payout fields at the object root the dev consumes (i.e. spread the flat profile fields alongside/above the nested `math.manifest`, or hand the dev `math.manifest` explicitly). Fields to surface at root: `gridId`, `reelStrips`, `reelLengths`, `payTable`, `scatterPay`, `freeSpinsCount`, `freeSpinsCap`, `freeSpinMultiplier`, `retriggerSpins`, `maxWinMultiplier`, `minWager`, `rtpBps`, and the whole `custom{}`. Keep the existing nested `math.manifest` for our own tooling. Then confirm with the dev which object they feed into `configFromMathProfile`.

**STATUS 2026-07-28 — SHIPPED.** `VICE_MATH_ROOT_KEYS` + `flattenMathRoot` (`exportPresetV2Core.ts:206-219`, Vice-gated) emit the flat copy, and the preset carries it at the root: `gridId` (:26079), `reelStrips` (:26080), `payTable` (:26292), `scatterPay` (:26334), `freeSpinsCount/Cap/Multiplier/retriggerSpins` (:26339-26342), `maxWinMultiplier` (:26343), `minWager` (:26344), `rtpBps` (:26345), `custom` (:26349), `fsReelStrips` (:46157). The nested `math.manifest` is unchanged.
**The flat root copy is a documented fallback, not a second source of truth** — `preset.math.manifest` is what we certify against; if the two ever disagree, the manifest wins.
**One gap left:** the key list looks for `reelLengths` (plural), and the manifest only has `reelLength: 40` (:245) — so strip length is absent from the root copy. Derivable from `reelStrips[i].length` today, but add `reelLength` to `VICE_MATH_ROOT_KEYS` at the next export, because a bought round / FS round swaps in strips of a *different* length (1215 / 2406 / 120 stops) and the length must travel with them.

## 2. D10 — expectedMetrics.rtpPct must be DERIVED FROM rtpBps

**Problem:** the dev assembler recomputes `RTP_BPS` from `expectedMetrics.rtpPct ?? 96` (`assembler.ts:52-53`). Whatever sits in that single field overwrites our certified `rtpBps` — so it has to be derived from the measured number, not from the design target.

**STATUS 2026-07-28 — exporter FIXED, shipped preset STILL WRONG → re-export required.**
- **Exporter: correct.** `exportPresetV2Core.ts:130-136` now sets `expectedMetrics.rtpPct = rtpBps / 100`, falling back to `targetRtpPct` only if `rtpBps` is missing.
- **Shipped preset: wrong.** It still carries `"expectedMetrics": { "rtpPct": 96 }` **twice** — under `math.manifest` (:26074-26076) and in the root flat copy (:26346-26348). `96` is `targetRtpPct` (:31), the DESIGN target. Fed to the assembler it stamps **RTP_BPS 9600 over our certified 9670** — the exact drift D10 exists to remove, reintroduced one field later. The preset was exported before the exporter fix landed.
- **Action:** re-export, then grep the new preset for `expectedMetrics`. Both copies must read **`96.7`** (= 9670 / 100). If either still reads `96`, the export is stale — do not hand it over.

> **HISTORY (2026-07-26, VOID):** this section originally read *"add `expectedMetrics: { rtpPct: 95.99 }`… overwriting our certified `rtpBps:9599 / 95.99`"*. `95.99 / 9599` is a retired figure from before the tower multipliers. Following that instruction would hand-stamp a void RTP into the manifest and re-create the drift it claims to remove. It is also **not** cosmetic-only: the assembler derives the operative `RTP_BPS` from this field.

---

## 3. AUDIO REMAP — the biggest our-side item

Re-shape the export to the dev's **fixed 12-key flat contract**: keys must be the dev registry IDs, files must ship **flat** as `/audio/<id>.ogg` (the runtime only reads `/audio/<id>.{wav,ogg,mp3}` — `defaultSoundConfig.ts:36,43`; manifest `soundManifestRenderer.ts:84`). Our nested `audio/library/<cat>/<file>.ogg` paths are never read; any non-registry key is dropped at compile (`soundManifestRenderer.ts:71-73`).

**STATUS 2026-07-28 — SHIPPED, except one loose end.** The export now carries **one** flat by-id block: `audio.events` (preset :52421-52497) with exactly the 12 dev registry keys, each `file: "/audio/<id>.ogg"`. `win-marquee` → **`win-screen-music`** (:52430), **`connect-symbol`** added (:52437), `coin-chime` kept (:52443), and every event the dev never dispatches (`wild-*`, `win-tally-*`, `tier-up`, `tease-*`) is gone. `audio.mixing.exclusiveGroups` pairs `ambient-music` with `win-screen-music` (:52414-52419). No nested `library/…` path and no `adone-6fddec.ogg` reference survive anywhere in the preset. Reshaping lives in `VICE_AUDIO_CONTRACT` / `viceAudioEvents` (`exportPresetV2Core.ts:161-199`).
**Still open:** there are two volume sources. `extras.presentationTuning.audio.events` (:53156+) carries its own, older levels — `spin-start 0.78`, `reel-stop 0.58` — while the dev-facing `audio.events` carries Noski's final mix, `spin-start 0.47` / `reel-stop 0.16` (:52451, :52457), matching `src/data/viceSoundPreset.json:14-15` 1:1. **The dev reads top-level `audio.events`.** The tuning block is our-side metadata (`oggFirst` flags + notes); reconcile or explicitly label it before the next hand-off so nobody mixes to the wrong numbers.
**Ambient level is 0.35, not 0.06.** Noski's FINAL mix (`src/data/viceSoundPreset.json:2,24`, set 2026-07-26) is `/audio/ambient-music.ogg` **@ 0.35**, and the export matches (:52424). The `gimme-that-groove-6d8237.ogg @ vol 0.06` line under the table is HISTORY — shipping it now would swap the approved track and drop the music to a sixth of the signed-off level.

> **HISTORY (2026-07-26) — the mapping table AND the "Also" list below have been EXECUTED.**
> Keep them as the record of *why* each key is named what it is named; do not re-run them against
> the current preset. All preset line numbers in them point into the *pre-remap* export and no
> longer resolve, and the "Result today" column describes that same old export. Two entries are
> actively wrong now and are corrected in the STATUS block above: the `ambient-music` table row and
> the "Also" bullet naming `gimme-that-groove-6d8237.ogg @ vol 0.06` — the shipped and approved
> ambient is `/audio/ambient-music.ogg` **@ 0.35**.

| Our current key (preset line) | Our source file (nested) | → Dev flat key | → Ship as | Result today | Action |
|---|---|---|---|---|---|
| `ambient-music` (:3650) | `library/ambient-music/adone-6fddec.ogg` **(STALE — purged pick)** | `ambient-music` | `/audio/ambient-music.ogg` = **`gimme-that-groove-6d8237.ogg` @ vol 0.06** | dev default synthwave plays | **replace file + vol, flatten** |
| `win-marquee` (:3657, :4301) | `library/win-marquee/payout-award-d55ce2.ogg` | **`win-screen-music`** | `/audio/win-screen-music.ogg` | silent win screen (`unavailable`) | **rename key + flatten** |
| `coin-chime` (:3676; note :4333 "connection swish") | `library/coin-chime/space-coin-win-notification-cc796e.ogg` | **`connect-symbol`** (also keep `coin-chime` if snapshot path still live) | `/audio/connect-symbol.ogg` | silent connections (`unavailable`) | **add key + flatten** |
| `spin-start` | nested library path | `spin-start` | `/audio/spin-start.ogg` | dev default `.wav` plays (path never read) | **flatten + deliver** |
| `reel-stop` | nested library path | `reel-stop` | `/audio/reel-stop.ogg` | dev default plays | **flatten + deliver** |
| `scatter-land` | nested library path | `scatter-land` | `/audio/scatter-land.ogg` | dev default plays | **flatten + deliver** |
| `free-spin-trigger` | nested library path | `free-spin-trigger` | `/audio/free-spin-trigger.ogg` | dev default plays | **flatten + deliver** |
| `win-small/normal/big/mega` (:4281-4300, vol 0) | — | `win-small`/`win-normal`/`win-big`/`win-mega` | flat (or omit; intentionally vol 0) | ok | keep vol 0, flatten if delivered |
| `wild-land` (:4310) | live path only | — (no dev dispatch) | — | dropped/silent | **drop from export** (or DEV adds dispatch) |
| `wild-expand` (:4314) | live path only | — | — | dropped/silent | **drop** (or DEV adds) |
| `win-tally-tick` (:4345), `win-tally-end` (:4350) | vol 0 | — | — | dropped | **drop** (or DEV adds) |
| `tier-up` (:4355) | — | — | — | dropped | **drop** (or DEV adds) |
| `tease-riser` (:4360), `tease-miss` (:4365) | live path only | — | — | dropped/silent | **drop** (or DEV adds) |

Also *(same HISTORY banner — all executed; the `0.06` bullet is superseded by the 0.35 STATUS note)*:
- **Collapse the two audio blocks** — top-level `audio.events` (nested library paths, :3636-3695) vs `extras.presentationTuning.audio.events` (by-id `srcRule:/audio/<id>.ogg`, :4267-4399) — into **one** dev-shaped by-id map so the compiler isn't guessing between `adone` and "default synthwave."
- **Delete** the `adone-6fddec.ogg` reference (:3650) and the contradictory "keeps default synthwave" note (:4343).
- Noski's real ambient pick + level is `gimme-that-groove-6d8237.ogg` @ **vol 0.06** (`src/data/viceSoundPreset.json:4,16`) — export currently baked neither block's value.
- The 7 valid-name events (`spin-start`, `reel-stop`, `scatter-land`, `free-spin-trigger`, `win-*`) currently play the **dev's default assets** because our files sit at nested paths — flattening + physically delivering the files fixes this too.
- **Dev-side dependency:** confirm with the dev the exact live spelling of `win-screen-music` and `connect-symbol` (they are fired by the live build but absent from the snapshot registry). Our rename resolves them only if those are the real keys.

---

## 4. PRESET DEFECTS (studio / export / asset fixes)

### 4a. Filename typo — `scatter_text_ntro_screen_vice.webp` (missing "i") — **CLOSED**
- **STATUS 2026-07-28: fixed on both sides.** The manifest reads `theme/vice/intro/game/scatter_text_intro_screen_vice.webp` (`dev-handoff/assets/introLayers.json:80`) and the shipped file is `dev-handoff/assets/theme/vice/intro/game/scatter_text_intro_screen_vice.webp`. No `_ntro_` spelling remains. Nothing to do.
- *Original entry:* the typo was baked into both the on-disk filename and the manifest, internally self-consistent, with the only risk being a one-sided "correction" later. Both were renamed together. (P3 cosmetic.)

### 4b. Buy-4 label "300x bet" vs 200× certified cost — **our-side hardening SHIPPED**
- **STATUS 2026-07-28: done on our side.** The exporter stamps an explicit label on every stage (`exportPresetV2Core.ts:141-147`) and the preset now carries `"label": "100X BET"` (:6408) and `"label": "200X BET"` (:18464) beside `costMult` 100 / 200. The engine no longer has to derive anything. **The root fix is still dev-side:** render the label from `costMult` verbatim — a build that computes `100×(scatters−1)` prices the 4-scatter buy at 300× and sells a 200×-certified round for 300× of the player's money.
- *Original entry, still the reasoning:* certified cost is **200×** (`math.manifest.custom.viceBuyStages` stage 2 `costMult: 200`, preset :6413 — the original entry cited :568-570, a pre-re-export line number; confirmed `features/vice-bonus-buy-ante.md:11`, and vice-buys-ante-certified memory). Our preset carries **only `costMult`, no label** — the "300x" is invented dev-side (their buy module deriving `100×(scatters−1)` = 300 for a 4-scatter buy). In our studio the "100X/200X BET" text is baked into the card art (`src/ui/BonusBuyOverlay.tsx:318-322`), not generated. **Root fix is dev's** (render label from `costMult` verbatim). **Our-side hardening (optional but recommended):** add an explicit `label`/`costLabelX` string to each `viceBuyStages[]` entry so the engine has zero room to invent one.

### 4c. Missing `retrigger.png`
- **Still open, still dev-side (re-verified 2026-07-28).** The dev HEAD-404s on `theme/win-tiers/retrigger.png`. Our preset declares `retrigger` **only as math** (`retriggerSpins: 3` at preset :295, :303, :26342, :26353) — **never as an asset**; `assets.winTiers.layers` is exactly `{big, mega, epic, max, win, plate}` (:52393-52403), with no retrigger tier. Vice's retrigger presentation is the FS-counter-plaque wheel + `fs-retrigger` sound, not a full-screen banner. **Our-side action: none to add the asset** (a retrigger banner is not in the certified Vice spec) — the fix is dev-side (gate marquee/FS probes on the declared `winTiers.layers` set, treat 404 as "no retrigger banner"). Only add art if product newly decides it wants one (new design item).

### 4d. Stale export — **CLOSED by the 2026-07-28 re-export**
**STATUS 2026-07-28.** The preset now reads `exportedAt: 2026-07-28T04:25:57.981Z` (:8) and all three items below are in it:
1. **Left-rail logo — exported.** `assets.images.logoLayout: "left"` (:52218); `extras.sizing.logoPlacement.layout: "left"` (:52719-52722); the tuning text at :53064 records the runtime source (`App.tsx:580 setTitleImage(logo.webp,'left')`). No `placement: "top …"` remains.
2. **Bottom reserve — exported.** `extras.sizing.bottomReserve` = `{basis:"height", fraction:0.12, formula:"round(height * 0.12)", waysOnly:true}` (:52712-52717). Note the shipped value is the **height-based 0.12**, not the width-based 0.125 that §5 proposed — see the corrected §5.
3. **FS counter plaques — exported and shipped.** `assets.images.fsPlaque: "theme/vice/free_spins_counter.png"` and `totalWinPlaque: "theme/vice/total_win_counter.png"` (:52231-52232); both PNGs are present in `dev-handoff/assets/theme/vice/`. Also newly shipped there: `wild_multi_sheet.webp` (the 5-frame tower-multiplier badge strip) and `chain_loader_sheet.webp` (platform boot loader).

Nothing to re-export for these three. The one thing that **is** still stale in the shipped preset is `expectedMetrics.rtpPct` — see §2.

> **HISTORY (2026-07-26):** at the time the preset was dated `2026-07-22` and the exporter itself had
> to be updated before a re-export would help. Kept because it explains *why* these three fields
> exist and where they come from in the runtime.

The preset (and our exporter + `vicePresentationTuning.json`) lagged the live runtime. **A plain re-export did NOT fix this — the exporter itself had to be updated first.** Three stale pieces, all in `src/studio/exportPresetV2Core.ts` (Vice block `:228-251`; compare Crack Farm `:279`) + `src/data/vicePresentationTuning.json`:

1. **Left-rail logo not exported.** Runtime truth: `src/App.tsx:580` → `setTitleImage(logo.webp, 'left')` (`PixiApp.ts:716` sig, `alignLeftRailLogo` `:774`). Exporter `exportPresetV2Core.ts:228` emits `logo: \`${B}logo.webp\`` with **no layout arg**, so "left" is never recorded; preset/tuning still say `logo.placement = "top …"` (`vicePresentationTuning.json:331`, preset ~:4180). **Fix:** exporter emits `logoLayout:'left'`; tuning JSON `layout.logo.placement → "left"` with the left-rail sizeRule.
2. **Grid enlargement / 12% bottom reserve not exported.** Runtime keeps the enlarged ways grid out of the HUD via `bottomReserve = round(height × 0.12)` (`PixiApp.ts:624`). Absent from `extras.sizing.scaleToFit` at the time. **Fix:** exporter emits a `bottomReserve` (ways-only) into the sizing block. *(Done — and the shipped value is the height-based `0.12`; the `bottomHudFraction 0.125` this line used to point at was rejected, see the corrected §5.)*
3. **FS counter plaques not exported/shipped.** Runtime: `src/App.tsx:581-584` → `setFsPlaquePair(free_spins_counter.png, total_win_counter.png)`. Neither referenced in the preset nor shipped in `dev-handoff/assets/theme/vice/` (they exist in our `public/theme/vice/`). **Fix:** (a) ship both files into `dev-handoff/assets/theme/vice/`; (b) reference them from the preset; (c) exporter's Vice block emits the `fsPlaque`/counter pair (Crack Farm already does at `:279`).

After updating the exporter + tuning JSON, **re-export and re-hand off** so `exportedAt` and all three items are current. *(Done — see the STATUS block above.)*

---

## 5. Bottom reserve — the shipped value is height × 0.12, NOT bottomHudFraction 0.125

**STATUS 2026-07-28 — the 0.125 proposal was TRIED and REJECTED. Do not implement it.**
- Live truth: `bottomHudFraction` stays at its default **0** (`PixiApp.ts:212`), and the ways (Vice 5×5) grid is sized and centred above a `bottomReserve = round(height × 0.12)` band computed inside `PixiApp.onResize` (`PixiApp.ts:635`). `GameCanvas.tsx:57-60` records the decision verbatim: the width-based 0.125 variant **shifted the grid against Noski's approved layout**, so it is off on purpose.
- The two do not stack: `PixiApp.ts:630-635` skips the legacy height reserve when a host sets `bottomHudFraction`. That is exactly why setting 0.125 *moves* the grid instead of merely refining it.
- The preset ships the live rule, not the proposal: `extras.sizing.bottomReserve` = `{basis:"height", fraction:0.12, waysOnly:true, note:"full-size 5×5 ways grid sized + centred ABOVE the bar band (Noski arrangement)"}` (:52712-52717).
- **If you build the 0.125 version, the grid no longer matches the signed-off Vice layout** (and the DOM control bar / left-rail dock line up against a different band). Build to `height × 0.12`, ways-only, non-compact.

> **HISTORY (2026-07-26) — superseded, do not implement:** *"set `bottomHudFraction = 0.125`
> explicitly (in `src/ui/GameCanvas.tsx` after `init`, or when wiring `ControlBar`) so the reserve is
> width-based (exact bar height) instead of approximate. On our 0.9709 box the two coincide
> (`0.125 × 0.9709 ≈ 0.1214 ≈ 0.12`), but the width-based value is canonical…"* The arithmetic is
> right and the two values are indeed close; the reason it was dropped is the visible layout shift,
> not the maths. The optional aspect pin (`GameCanvas.tsx:125` box → exactly `688/708`) is untouched
> by this and remains a fair cleanup.

---

## 6. Already CORRECT in the preset — DO NOT TOUCH

> **CORRECTED 2026-07-28 — the previous version of this list was VOID.**
> Every value below was re-read out of the shipped preset (line numbers are that file). The
> 2026-07-26 list quoted `targetRtpPct 95.99` / `rtpBps 9599` / `simResults.rtp_pct 95.989`,
> `scatterPay [768,1490,4471]`, and stage RTPs `94.09` / `94.65` / `94.92`. **None of those is in
> the export and none of them describes the shipped game.** Because they sat under a *"DO NOT
> TOUCH … changing these introduces regressions"* heading, they were the numbers in this package
> most likely to be copied into an implementation unchecked. Concretely: `scatterPay[0] = 768` pays
> **0.0768×** where the shipped game pays **0.1164×** on a 3-scatter — a 34% under-pay on the single
> most frequent scatter outcome — and `payTable` floors of 768 under-pay the whole low-symbol range,
> which drags the round well below the certified 96%. The old buy/ante figures (94.09 / 94.65 /
> 94.92) date from before the tower multipliers and the buy re-fit; a stage priced off them is
> mispriced.

Re-verified against the shipped export; changing these introduces regressions:

- **Grid/sizing:** `grid.id "5x5"`, cell `{w:120, h:110, gapV:6, gapH:8}`, `framePad 28`, `headerH 52` (preset :14-26); `extras.sizing.machineBox.activeGridPx {gridW 632, gridH 580, machineW 688, machineH 636, totalH 708}` (:52671-52677); `extras.sizing.renderer.resolution: 2` (:52681) — a FIXED floor-2 supersample, `max(2, min(devicePixelRatio, 2))`, with filters on `resolution: 'inherit'` or they render pixelated.

- **Core math values:** `rtpBps 9670` (:32) is the **operative** certified RTP; `targetRtpPct 96` (:31) is display metadata only (`extras.rtpNote`, :53288). `reelStrips` 5×40 (`reelLength: 40`, :245), symbol IDs 0–8. `maxWinMultiplier 5000` (:297), `minWager 10000` (:298). `freeSpinsCount 7`, `freeSpinsCap 10`, `retriggerSpins 3`, `freeSpinMultiplier 1` (:293-296) — retrigger is **+3, not +7**, and the multiplier is deliberately 1 because the value comes from the expansion + the tower badges, not from a flat FS multiplier.

- **Paytable — ship these exact bps** (`math.manifest.payTable`, :246-287; the three entries are 3-/4-/5-of-a-kind, divide by 10000 for × bet):

  | symbol | 3 | 4 | 5 |  | symbol | 3 | 4 | 5 |
  |---|---|---|---|---|---|---|---|---|
  | `wild`  | 1243 | 2034 | 3616 |  | `midD` | 1164 | 1469 | 2147 |
  | `highA` | 1243 | 2034 | 3616 |  | `lowE` | 1164 | 1356 | 1808 |
  | `highB` | 1198 | 1808 | 2938 |  | `lowF` | 1164 | 1299 | 1638 |
  | `midC`  | 1164 | 1582 | 2373 |  | `lowG` | 1164 | 1243 | 1469 |

  `scatterPay [1164, 2260, 6780]` (:288-292) for 3 / 4 / 5 scatters. **The pay floor is 1164 bps = 0.1164×** — if any cell in your build reads 768 / 0.0768×, you are on the void table.

- **Bonus mechanics — the `custom{}` block is the spec.** These are the fields a rebuild most often gets wrong:
  - `stickyTowerCap 5` (:302, and repeated on **both** buy stages at :6405 and :6415). Not 3, not 4.
  - `stickyFullBoardMultiplier 1` (:306) — the full-house ×2 doubling is **OFF**. The field exists so the value is explicit; do not "restore" a ×2.
  - `simulExpandMultipliers` **does not exist in the preset** — grep it, you will find nothing. There is no simultaneous-expansion multiplier ladder. **1–4 wild reels pay natural ways.**
  - `fullBoardInstantMaxWin: true` (:20095) — 5 fully wild reels pay exactly `maxWinMultiplier × bet` **instantly**, end the round, in **both** bonuses, with nothing multiplied on top. Together with the running-total cap at `maxWinMultiplier × wager` these are the **only two** routes to max win.
  - `towerMultiplierWeights [55, 20, 9, 6, 10]` (:20096-20102) + `towerMultiplierRule` / `towerMultiplierStickyRule` / `towerMultiplierOnHotSpins: false` (:20103-20105). Every reel standing fully wild in a free spin is dealt a ×1–×5 badge; a combination pays × the **HIGHEST** badge it crosses — never the product (that measures 187% RTP on a bought 4-scatter round, per the rule text at :20103). Scatter pay is never multiplied, nothing stacks on the instant max win, hot spins carry no badge. A 4-scatter sticky tower keeps the badge it was dealt when it **joined**; a 3-scatter round redraws each spin. Art: `theme/vice/wild_multi_sheet.webp`, 5 frames. **Omit this mechanic and the free spins pay a ~71.6% floor against the certified 96.46%.**
  - `hotSpinChance1In 80` + `hotSpinExpandsWilds: true` (:307-308) — natural/ante **base** spins only, never on a bought round (the stage notes at :6404 / :18459 say so explicitly: expansion would erase the scatters the player paid for).
  - `stickyRoundSpins 10`, `stickyRoundCap 13` (:304-305).

- **Buy/ante — prices verbatim from `costMult`:** stage 1 `costMult 100` (:314), stage 2 `costMult 200` (:6413) with `guaranteedTowerOnFirstSpin: true` / `guaranteedTowerReel: 0` (:18462-18463), `anteBet.costMult 3.25` (:18469). Certified: **buy3 96.20% ±0.49pp**, **buy4 95.97% ±0.56pp** (independent simulator, 4M), **ante 96.00% ±1.16pp / 20M** — all from `simResults` (buy3 :20132-20139, buy4 :20140-20177, ante :20178-20204). The `label` fields `"100X BET"` / `"200X BET"` (:6408, :18464) are the 4b hardening and are now shipped.
  - **Two stage-level fields here are NOT trustworthy** (our-side cleanup, next export): stage 1 carries `certifiedRtpPct 96.17` (:315) while `simResults.buy3.rtpPct` reads `96.35` (:20133), and **both** stages carry `"certifiedRounds": 8000000` (:6407, :18461) — no 8M-round buy-stage run exists; the actual rows are 500k for buy3 (:20135) and 100k plus a 4M independent confirmation for buy4 (:20143, :20164). **`math.manifest.simResults` is the source of truth for every certified figure; the per-stage `certifiedRtpPct` / `certifiedRounds` are stale metadata.**

- **Win-line color:** `extras.presentationTuning.winPresentation.winLineColor.default 0xFFC53D` (:52919-52922, `strokeWidth 11`, `strokeAlpha 0.9`) already matches the dev's `WIN_LINE_COLOR` — do not change the hue; the win-line issue is choreography, handled dev-side.

- **Symbol-size encoding:** `extras.sizing.symbolDraw` (:52724-52732) — `targetSize = round(min(cell.w, cell.h) × 0.88 × objectScale × perSymbolMul)` with `objectScale 1.3` and `perSymbolMuls {default 0.8, scatter 0.96}` (the key is `perSymbolMuls`, plural). ~2% off the dev's `ASSET_SPECS §4` numbers but the effective sizes match — reconcile only for cleanliness, not required.

- **Intro/flow config:** `flow` is at the **preset root** (:52508) with `flow.iris.style "looney-iris"` (:52509-52511) and the stage list at :52512+. The layer inventories live at `extras.presentationTuning.layout.introScreens` (:53133-53139 — game 18 layers, fs3 6, fs4 6, outro 3) and `extras.presentationTuning.layout.bootScreen` (:53140+). Fully specified and correct; simply unread by the dev today (dev-side intro work). No our-side change needed.

- **JSON paths — these are the real ones** (several sibling documents cite keys that do not exist):
  - `extras` has exactly five top-level keys: `profileId` (:52634), `sizing` (:52635), `presentationTuning` (:52734), `schemaNotes` (:53285), `rtpNote` (:53288).
  - `visualParams` is at the **preset root** (:52499) — there is no `extras.visualParams`.
  - Layout blocks are under `extras.presentationTuning.layout` (:53061) — there is no `extras.layout`.
  - Marquee tier art is `extras.presentationTuning.winPresentation.marquee.tierArt` (:52969) — not `extras.presentationTuning.marquee.tierArt`.
  - Math to ingest is `preset.math.manifest`; the flat root copy (§1) is a documented fallback, not a second source of truth.

- **All theme art** referenced in the preset exists in `dev-handoff/assets/theme/vice/` — logo, backgrounds, `wild_column`, frame, all 9 symbol landings + win sheets, scatter idle/win, bg loops, `frame_win_flash`, coinRain, win-tiers layers — **including** the FS counter plaques `free_spins_counter.png` + `total_win_counter.png` (4d.3, now shipped), plus `wild_multi_sheet.webp` (tower badges) and `chain_loader_sheet.webp` (platform boot loader). `assets.winTiers.layers` is exactly `{big, mega, epic, max, win, plate}` (:52393-52403) — no `retrigger` tier, which is the whole point of 4c.

> **HISTORY — the void numbers this section used to carry, recorded so nobody re-derives them:**
> `targetRtpPct 95.99` · `rtpBps 9599` · `simResults.rtp_pct 95.989` · `scatterPay [768, 1490, 4471]` ·
> buy stage RTPs `94.09` / `94.65` / `94.92`. All measured before the tower multipliers existed and
> before the buys and the ante were re-fitted; they are not in the export and must not be restored.
