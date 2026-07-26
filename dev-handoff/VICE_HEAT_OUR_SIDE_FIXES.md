# Vice Heat — OUR-Side Fixes (Studio / Export / Preset)

Scope: **only** what our team changes in the studio, the exporter, and the preset. Everything engine-side is in `VICE_HEAT_FIXES_FOR_DEV.md`. Do **not** edit dev code from here.

Preset: `dev-handoff/preset/vice-heat.chainwtf-preset.json` · Exporter: `src/studio/exportPresetV2Core.ts` · Tuning JSON: `src/data/vicePresentationTuning.json` · Runtime truth: `src/App.tsx`, `src/game/PixiApp.ts`.

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

## 2. D10 — Add expectedMetrics.rtpPct to the manifest

**Problem:** the dev assembler recomputes `RTP_BPS` from `expectedMetrics.rtpPct ?? 96` (`assembler.ts:52-53`); our manifest lacks `expectedMetrics.rtpPct`, so it stamps `9600 / 96.0`, overwriting our certified `rtpBps:9599 / 95.99`.

**Fix:** add `expectedMetrics: { rtpPct: 95.99 }` to the exported manifest. Best place: extend the `ensureRtpBps`-style guarantee helper in `exportPresetV2Core.ts:96-104` (which already guarantees `out.rtpBps`) to also set `out.expectedMetrics = { rtpPct: <sim rtp> }`. Cosmetic-only (risk-reserve quote), but trivial and removes the 1-bps drift.

---

## 3. AUDIO REMAP — the biggest our-side item

Re-shape the export to the dev's **fixed 12-key flat contract**: keys must be the dev registry IDs, files must ship **flat** as `/audio/<id>.ogg` (the runtime only reads `/audio/<id>.{wav,ogg,mp3}` — `defaultSoundConfig.ts:36,43`; manifest `soundManifestRenderer.ts:84`). Our nested `audio/library/<cat>/<file>.ogg` paths are never read; any non-registry key is dropped at compile (`soundManifestRenderer.ts:71-73`).

**Mapping table (our current export → dev flat key + file to deliver):**

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

Also:
- **Collapse the two audio blocks** — top-level `audio.events` (nested library paths, :3636-3695) vs `extras.presentationTuning.audio.events` (by-id `srcRule:/audio/<id>.ogg`, :4267-4399) — into **one** dev-shaped by-id map so the compiler isn't guessing between `adone` and "default synthwave."
- **Delete** the `adone-6fddec.ogg` reference (:3650) and the contradictory "keeps default synthwave" note (:4343).
- Noski's real ambient pick + level is `gimme-that-groove-6d8237.ogg` @ **vol 0.06** (`src/data/viceSoundPreset.json:4,16`) — export currently baked neither block's value.
- The 7 valid-name events (`spin-start`, `reel-stop`, `scatter-land`, `free-spin-trigger`, `win-*`) currently play the **dev's default assets** because our files sit at nested paths — flattening + physically delivering the files fixes this too.
- **Dev-side dependency:** confirm with the dev the exact live spelling of `win-screen-music` and `connect-symbol` (they are fired by the live build but absent from the snapshot registry). Our rename resolves them only if those are the real keys.

---

## 4. PRESET DEFECTS (studio / export / asset fixes)

### 4a. Filename typo — `scatter_text_ntro_screen_vice.webp` (missing "i")
- Should be `scatter_text_intro_screen_vice.webp`. The typo is baked into **both** the on-disk filename **and** the manifest (`dev-handoff/assets/introLayers.json:80`). It is internally self-consistent and loads fine today — the only risk is a one-sided "correction" later. **Fix:** rename the file AND the manifest line together. (P3 cosmetic.)

### 4b. Buy-4 label "300x bet" vs 200× certified cost
- Certified cost is **200×** (`math.manifest.custom.viceBuyStages` stage2 `costMult:200`, preset lines 568-570; confirmed `features/vice-bonus-buy-ante.md:11`, and vice-buys-ante-certified memory). Our preset carries **only `costMult`, no label** — the "300x" is invented dev-side (their buy module deriving `100×(scatters−1)` = 300 for a 4-scatter buy). In our studio the "100X/200X BET" text is baked into the card art (`src/ui/BonusBuyOverlay.tsx:318-322`), not generated. **Root fix is dev's** (render label from `costMult` verbatim). **Our-side hardening (optional but recommended):** add an explicit `label`/`costLabelX` string to each `viceBuyStages[]` entry so the engine has zero room to invent one.

### 4c. Missing `retrigger.png`
- The dev HEAD-404s on `theme/win-tiers/retrigger.png`. Our preset declares `retrigger` **only as math** (`retriggerSpins:3`, preset lines 295/303/3301) — **never as an asset**, and the certified marquee art set is exactly `{big, mega, epic, max, win, plate}` (`features/win-marquees/feature.json:53-56`), with no retrigger tier. Vice's retrigger presentation is the FS-counter-plaque wheel + `fs-retrigger` sound, not a full-screen banner. **Our-side action: none to add the asset** (a retrigger banner is not in the certified Vice spec) — the fix is dev-side (gate marquee/FS probes on the declared `winTiers.layers` set, treat 404 as "no retrigger banner"). Only add art if product newly decides it wants one (new design item).

### 4d. Stale export — `exportedAt: 2026-07-22` predates the current layout
The preset (and our exporter + `vicePresentationTuning.json`) lag the live runtime. **A plain re-export does NOT fix this — the exporter itself must be updated first.** Three stale pieces, all in `src/studio/exportPresetV2Core.ts` (Vice block `:228-251`; compare Crack Farm `:279`) + `src/data/vicePresentationTuning.json`:

1. **Left-rail logo not exported.** Runtime truth: `src/App.tsx:580` → `setTitleImage(logo.webp, 'left')` (`PixiApp.ts:716` sig, `alignLeftRailLogo` `:774`). Exporter `exportPresetV2Core.ts:228` emits `logo: \`${B}logo.webp\`` with **no layout arg**, so "left" is never recorded; preset/tuning still say `logo.placement = "top …"` (`vicePresentationTuning.json:331`, preset ~:4180). **Fix:** exporter emits `logoLayout:'left'`; tuning JSON `layout.logo.placement → "left"` with the left-rail sizeRule.
2. **Grid enlargement / 12% bottom reserve not exported.** Runtime keeps the enlarged ways grid out of the HUD via `bottomReserve = round(height × 0.12)` (`PixiApp.ts:624`). Absent from `extras.sizing.scaleToFit` (preset :3814-3823). **Fix:** exporter emits a `bottomReserve` (ways-only) into the sizing block; see §5 for the canonical `bottomHudFraction 0.125`.
3. **FS counter plaques not exported/shipped.** Runtime: `src/App.tsx:581-584` → `setFsPlaquePair(free_spins_counter.png, total_win_counter.png)`. Neither referenced in the preset nor shipped in `dev-handoff/assets/theme/vice/` (they exist in our `public/theme/vice/`). **Fix:** (a) ship both files into `dev-handoff/assets/theme/vice/`; (b) reference them from the preset; (c) exporter's Vice block emits the `fsPlaque`/counter pair (Crack Farm already does at `:279`).

After updating the exporter + tuning JSON, **re-export and re-hand off** so `exportedAt` and all three items are current.

---

## 5. Set bottomHudFraction = 0.125 explicitly (our side)
- Our grid bottom reserve is currently the approximate hardcoded `height × 0.12` (`PixiApp.ts:624`); `bottomHudFraction` defaults to 0 though it's documented as `150/1200 = 0.125` (`PixiApp.ts:209-211`). **Fix:** set `bottomHudFraction = 0.125` explicitly (in `src/ui/GameCanvas.tsx` after `init`, or when wiring `ControlBar`) so the reserve is width-based (exact bar height) instead of approximate. On our 0.9709 box the two coincide (`0.125 × 0.9709 ≈ 0.1214 ≈ 0.12`), but the width-based value is canonical and keeps dev+studio identical on non-matching containers. Optionally pin the `GameCanvas.tsx:125` box aspect to exactly `688/708` (from `5/5.15`) for zero drift.

---

## 6. Already CORRECT in the preset — DO NOT TOUCH

Verified correct against the dev contract + `ASSET_SPECS.md`; changing these introduces regressions:
- **Grid/sizing:** `grid.id "5x5"`, cell `{w120,h110,gapV6,gapH8}`, `framePad 28`, `headerH 52`; `machineBox.activeGridPx {gridW632, gridH580, machineW688, machineH636, totalH708}`; `renderer.resolution: 2` (floor-2 supersampling).
- **Core math values:** `targetRtpPct 95.99`, `rtpBps 9599`, `simResults.rtp_pct 95.989`; `reelStrips` 5×40, symbol IDs 0–8; `payTable` + `scatterPay [768,1490,4471]`; `maxWinMultiplier 5000`; `minWager 10000`; `freeSpinsCount 7`, `freeSpinsCap 10`, `retriggerSpins 3`, `freeSpinMultiplier 1` (deliberately 1 — value comes from expansion, see dev doc D5).
- **Buy/ante numbers:** `viceBuyStages` stage1 100× / 94.09%, stage2 200× / 94.65%; `anteBet` costMult 3.25 / 94.92%. **The numbers are right** — only the label hardening (4b) is our optional add.
- **Win-line color:** `winLineColor.default 0xFFC53D` already matches the dev's `WIN_LINE_COLOR` — do not change the hue; the win-line issue is choreography, handled dev-side.
- **Symbol-size encoding:** `symbolDraw baseFill 0.88 × objectScale 1.3 × perSymbolMul {default 0.8, scatter 0.96}` is ~2% off the dev's `ASSET_SPECS §4` numbers but the effective sizes match — reconcile only for cleanliness, not required.
- **Intro/flow config:** `flow` stages, `iris:"looney-iris"`, `introScreens` (18/6/6/3 layers), `bootScreen` — fully specified and correct; they are simply unread by the dev (dev-side intro work). No our-side change needed.
- **All theme art** referenced in the preset exists in `dev-handoff/assets/theme/vice/` (logo, backgrounds, wild_column, frame, all 9 symbol landings + win sheets, scatter idle/win, bg loops, frame_win_flash, coinRain, win-tiers layers) — **except** the FS counter plaques (4d.3), which we must add.
