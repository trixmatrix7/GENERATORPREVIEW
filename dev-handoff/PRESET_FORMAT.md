# Preset format — a key-by-key ingestion map

`preset/vice-heat.chainwtf-preset.json` is Vice Heat in the standardised
`chainwtf-game-preset` **v2** schema (your schema — 0 validation errors). This
document says what every top-level key is and **what your loader must do with
it**, so nothing has to be guessed.

---

## 0. THE FIVE-MINUTE CHECK — do this before anything else

**Which object do you pass to `configFromMathProfile` / `buildGameConfigFromMathProfile`?**

```
✅  preset.math.manifest       ← THIS ONE
❌  preset                     ← reelStrips is undefined
❌  preset.math                ← reelStrips is undefined
```

Our math is nested under `math.manifest`; your loaders read those keys at the
**profile root**. Feed the wrong object and `reelStrips` comes back `undefined`,
your builder silently falls back to the **Fantasy 5×3 default**, and the game
plays completely different math with no error anywhere. That single mistake
would look exactly like "the math is fundamentally wrong".

**As a safety net we also flatten the load-bearing math onto the preset root** —
`reelStrips`, `payTable`, `scatterPay`, `freeSpinsCount`, `freeSpinsCap`,
`freeSpinMultiplier`, `retriggerSpins`, `maxWinMultiplier`, `minWager`,
`rtpBps`, `custom`, `fsReelStrips`, `gridId`, `expectedMetrics`.

> ⚠️ **The flat copies are a fallback, not a second source of truth.** They are
> emitted from the same manifest in the same pass, so they cannot disagree — but
> if you ever see them disagree, `math.manifest` wins and the export is broken.
> Read one or the other; never merge both.

---

## 1. Top-level keys

| key | type | what your loader does with it |
|---|---|---|
| `schema` | string | must read `chainwtf-game-preset`; reject otherwise |
| `version` | number | `2`. Bump = breaking change |
| `generator`, `exportedAt` | object / ISO string | provenance only, ignore at runtime |
| `game` | `{id, theme, label}` | `id` = `vice-heat`, `theme` selects the art bundle, `label` is the display name |
| `grid` | `{id, reels, rows, cell, framePad, headerH}` | **layout geometry in px** — `cell {w,h,gapV,gapH}` is authoritative, do not re-derive it |
| **`math`** | `{mode, manifest}` | **`manifest` is the object to ingest** (see §0). `mode` names the pay model — for Vice, `ways` |
| `mechanics[]` | array | the feature list — see §2 |
| `assets` | object | art bundle: `root`, `theme`, `images`, `symbols`, `spritesheets`, `winTiers`, `introLayers`. Sheet geometry (cols/rows/count/fps) is carried per entry; see `ASSET_SPECS.md` |
| `audio` | `{format, dir, mixing, events}` | flat `/audio/<id>.ogg` contract — see §4 |
| `visualParams` | object | studio parameters = **the locked look**. Apply each 1:1 — see §3 |
| `flow` | `{iris, stages[]}` | the presentation pipeline, in order. **`stages[0]` is `boot` and it is mandatory** — see §5 |
| `extras` | object | `profileId`, `sizing` (the `machineBox` package), `presentationTuning` (the full 1:1 tuning block), `schemaNotes`, `rtpNote` |
| *(flat math keys)* | mixed | the §0 fallback copies |

---

## 2. `mechanics[]` — what to switch on

Each entry is `{ id, kind, enabled, affectsMath, mathBinding[], params, compatibleGrids? }`.

- **`mathBinding[]` is the contract.** It names the exact `custom.*` keys that
  mechanic reads. Nothing in `params` changes a payout — if a number affects
  money it lives in the manifest and the mechanic only points at it.
- **`affectsMath: true` means you cannot ship without it.** Dropping such a
  mechanic does not degrade gracefully; it silently changes the RTP.
- `params` are render/tuning values and prose notes for the ones that need
  explaining.

Vice ships 13. The ones that carry money:

| id | binds | if you drop it |
|---|---|---|
| `expanding-wild` / `sticky-expanding-towers` | `custom.expandingWildsInFreeSpins`, `custom.stickyTowerCap`, `custom.fullBoardInstantMaxWin`, `fsReelStrips` | most of the RTP disappears — the game was designed to live in the bonus |
| `tower-multipliers` | `custom.towerMultiplier*` | the free spins land far under target |
| `hot-spins` | `custom.hotSpinChance1In`, `custom.hotSpinExpandsWilds` | base game loses ~3.8 %, the **ante collapses to ~84 %** |
| `buy-stages` | `custom.viceBuyStages` | the buy buttons cannot be priced or seeded |
| `ante-bet` | `custom.anteBet` | ditto |
| `tiered-free-spins` | `freeSpinsCount`, `custom.stickyRoundSpins`, … | wrong spin counts |

The rest (`ways-light`, `win-marquees`, `universal-anticipation`,
`frame-win-flash`, `scatter-trigger-beat`, `sound-volume-parameters`) are
presentation and RTP-neutral.

---

## 3. `visualParams` — the locked look

`applyVisualParam(id, value)` pairs. These are **settings**, deliberately not
baked into the art, so you can tune them without a re-export. Apply each one
literally; the values shipped are the look our build ships.

This drop carries the expanded-wild tower:

| id | default | what it does |
|---|---|---|
| `expandWildBackdrop` | `#0b0d14` | fill of the panel behind the tower art |
| `expandWildBackdropAlpha` | `1` | `0` = the reel shows through |
| `expandWildBorder` | `#ff3ea5` | border colour around the wild reel |
| `expandWildBorderWidth` | `0` | px; **0 = no border**, which is the shipped look |
| `expandWildBorderAlpha` | `1` | border opacity |
| `expandWildMultiPop` | `1.45` | overshoot scale of the ×N badge lock-pop |
| `expandWildMultiPopTime` | `0.42` | duration of that pop, in seconds |

Draw order for the tower: panel fill → optional border stroke on the same
rounded rect (radius = the reel's corner radius) → tower art on top.

---

## 4. `audio`

`format` is `ogg`, `dir` is `/audio/`, and `events` is a **flat map keyed by your
registry ids** — every file is referenced as `/audio/<id>.ogg`. Each event
carries `{file, volume, loop?, exclusive?, role, enabled, trim?}`. `trim` is a
play-time window `{offsetMs, durMs, fadeOutMs, gainDb}`: seek, gain, fade — no
re-baking needed.

The 12 shipped events are Noski's final mix at his exact levels. His mix also
uses `fs-retrigger`, `tease-riser`, `tease-miss`, `wild-land` and `wild-expand`
— **your runtime never dispatches those events**, so they are silent in your
build until you fire them.

---

## 5. `flow.stages[]` — the pipeline, in order

The array is the running order. `controlBar` is the DOM bar's visibility per
stage; `transitionIn` / `transitionOut` carry the iris technique and exact
seconds.

> ⚠️ **`stages[0]` is `boot` and it is missing from your build entirely.** It
> carries `universal: true` and `mustBeFirst: true`: the CHAIN GAMES loader is
> **platform branding**, identical in every game the generator produces, and it
> has to run before anything else renders. Its `params` block is the complete
> spec — sheet geometry, the stepping rules, the bar, and the one rule that is
> easy to get wrong: **the bar must not reach full before the logo has finished
> playing.** Long form with the failure modes: `features/boot-loader/`.

Full stage-by-stage prose, including every transition and the control-bar
visibility table, is in `FLOW.md`.

---

## 6. What this package is *not*

It contains **only Vice Heat**. No other game's assets, sounds, mechanics or
math are in here, and nothing in it is a leftover from an earlier drop —
`preset/vice-heat.chainwtf-preset.json` is regenerated from the live repo by
`custom-math/emit_vice_preset.mjs`, so it cannot drift from what our build
actually runs.
