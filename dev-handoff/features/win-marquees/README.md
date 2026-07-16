# Tiered Win Marquee (universal celebration)

A full-screen, layered celebration overlay that slams in for big wins and
**escalates its tier live while the win amount counts up**: `BIG WIN → MEGA WIN
→ EPIC WIN → MAX WIN`. Below a threshold no marquee plays and the win stays
on-board. The marquee is built from a shared, aligned art set (four tier words +
a gold `WIN` layer + a number plate) plus an optional coin-rain overlay and its
own exclusive music track.

> **This feature is UNIVERSAL.** It runs in every game on this runtime, not just
> the reference skin ("Vice Heat"). The choreography, the count-up hero number,
> the tier escalation, the layered art contract, and the music are all
> theme-neutral. A game only re-skins it by dropping in its own six PNG layers
> and its own per-game SFX colour — the marquee music itself is a neutral
> orchestral fanfare (one short 5-note hook) shared across all games.

Reference implementation:
- `src/game/WinCelebration.ts` — the overlay class + `WIN_CELEBRATION_CONFIG`.
- `src/game/PixiApp.ts` — tier resolution (`playCoinWin`) + host wiring
  (`setWinTierImages`, `setWinCoinRain`, `setMarqueeSoundHooks`).
- `src/App.tsx` — asset URLs + marquee↔ambient music hookup.
- `src/audio/*` — the `win-marquee` sound event (exclusive, ducks ambient).

---

## 1. Trigger and tier resolution

The marquee is driven by ONE number: the win-to-bet multiplier
`r = winAmount / wager`. The host resolves a tier index and calls
`WinCelebration.play({ ..., tier })`. Resolution lives in
`PixiApp.playCoinWin()`:

```ts
const r    = wager > 0n ? Number(winAmount) / Number(wager) : Number(winAmount);
const capX = config.maxWinMultiplier;              // e.g. 5000 (from the math profile)
const isMax = capX > 0 && r >= capX * 0.999;       // the win hit the game's max-win cap
if (!isMax && r < 15) return;                      // < minBigWin → NO marquee (stays on-board)
const tier = isMax ? 3
           : r >= 100 ? 2                          // bands.epic
           : r >= 25  ? 1                          // bands.mega
           : 0;
```

| Tier index | Word | Fires when | Notes |
|---|---|---|---|
| — | (no marquee) | `r < 15` **and** not max | Small/medium wins present on-board only |
| `0` | **BIG WIN** | `15 ≤ r < 25` | Entry tier |
| `1` | **MEGA WIN** | `25 ≤ r < 100` | |
| `2` | **EPIC WIN** | `100 ≤ r < cap` | |
| `3` | **MAX WIN** | `r ≥ maxWinMultiplier × 0.999` | Only when the round hit the game's hard payout cap |

`minBigWin` (15), `bands.mega` (25) and `bands.epic` (100) live in
`WIN_CELEBRATION_CONFIG`. The MAX tier is **not** a multiplier band — it is
gated purely on the win reaching the game's `maxWinMultiplier` cap (default
`5000`, read from the active math profile).

These marquee thresholds are **decoupled** from two other tier systems in the
repo, which the generator should not confuse with this overlay:
- `src/registries/winScreenTiers.ts` — lightweight *on-board* banner escalation
  (small/normal/big/mega… at 2×/10×/50×) used for the base win presentation.
- `src/audio/useSoundLayer.ts` `selectWinSound()` — per-win stinger tiers
  (2×/10×/50×). When the marquee owns the audio (`r ≥ 15`) those stingers and
  the coin-chime accents are silenced so they never double under the marquee
  music.

### Live promotion during the count-up

The hero is a single counter tween from `0 → winAmount`. As the counter crosses
value-space thresholds it **promotes the tier word live** (a hard, kicky
switch), so a big win visibly climbs `BIG → MEGA → EPIC` while the number rolls.

- Value thresholds: `th = [0, wager×25, wager×100]` (mega, epic).
- Live promotion is **capped at EPIC** (`liveMax = min(finalTier, 2)`).
- **MAX never promotes mid-count.** EPIC holds until the number has fully
  counted to the cap, then MAX slams in `0.18 s` after the count completes.

---

## 2. The layered art set (six aligned layers)

The marquee is composited from six PNGs, **all authored on the same
1920×1080 canvas** so they stack 1:1 and animate independently. Reference art
lives in `theme/win-tiers/`.

| Key | File (ref skin) | Role | Content-centre Y (fraction of 1080) |
|---|---|---|---|
| `big`  | `big.png`  | "BIG WIN" tier word | `0.2273` |
| `mega` | `mega.png` | "MEGA WIN" tier word | `0.2463` |
| `epic` | `epic.png` | "EPIC WIN" tier word | `0.2495` |
| `max`  | `max.png`  | "MAX WIN" tier word | `0.2269` |
| `win`  | `win.png`  | shared gold "WIN" band | `0.4875` |
| `plate`| `plate.png`| number plate (holds the count-up text) | `0.7681` |

Only ONE tier word is shown at a time; promotion swaps the `tierSpr` texture and
re-anchors it on that word's content-centre Y (so pulses stay centred). The
`win` band and `plate` are always present.

Geometry constants (fractions of the 1080-px canvas, from `WinCelebration.ts`):
- Plate bbox height `PLATE_H = 0.374`.
- Union content bbox height `CONTENT_FRAC = 0.911`, union content-centre
  `CONTENT_CY ≈ 0.4995` — the whole stack pivots here so it lands dead-centre
  on the supplied `centre` point.
- On-screen size: the art's content height is scaled to
  `min(screenW, screenH) × 0.55 × sizeMul` where `sizeMul = 0.48`.
- The count-up amount text is drawn **inside the plate** at font size
  `round(PLATE_H × 1080 × 0.40)`, gold fill `0xffe9a0`, dark stroke, drop shadow.

**Fallback (no art loaded):** if `setTierImages(null)` (or a load failure) the
overlay bakes a foil wordmark from `words = ['BIG WIN','MEGA WIN','EPIC WIN',
'MAX WIN']` at `wordFontSize/amountFontSize` sizes. Art is strongly preferred;
the fallback exists only so the celebration never no-ops.

---

## 3. Timeline (exact numbers)

All seconds; driven by GSAP + a per-frame ticker (pulse + trauma shake). Times
are relative to `play()` start. `T = tier index (0..3)`.

**Entrance — a heavy STAMP, not a fade** (`stampLand = 0.26`):
- `0.00` `onMarqueeStart` fires (music). Coin rain fades in over `0.35` (if any).
- `0.00–0.26` marquee scales `1.7× → 1.0×` (`power3.in`); tier word fades in over
  `0.18` (`power1.out`); rotation `-0.045 → 0` over `0.34` (`back.out(3)`, from `0.06`).
- `0.26` landing: additive flash-clone of the tier word bursts (alpha→0 over
  `0.30`, scale `1 → 1.4`); one-shot pulse kick `0.40`; trauma shake `1`.
- `0.30` `WIN` band fades in (`0.08`).
- `0.38` plate fades in (`0.16`) and rises `+70 → 0` (`power3.out`, `0.32`).
- `0.44` amount text reveals (`0.14`) and rises `+70 → 0` (`0.32`).

**Count-up** (starts at `countAt = 0.56`):
- One counter `0 → winAmount`, duration `countDur[T]`, ease `power1.inOut`.
- Text = `counter.toFixed(dp)`, `dp = decimals > 4 ? 2 : decimals`; final frame
  snaps to the fully-formatted amount.
- Live tier promotion fires here (see §1). Each promotion: additive flash-clone
  of the OLD word bursts (alpha→0 `0.28`, scale `1 → 1.5`); new word snaps in
  with pulse kick `0.50`; the **whole marquee steps up** to
  `baseScale × tierScale[n]` over `0.42` (`back.out(2.8)`); trauma escalates to
  that tier's `shake[n]` / `shakeRot[n]`.

**End flare** (`at = 0.56 + countDur[T]`):
- Pulse kick `0.18`; for EPIC/MAX (`T ≥ 2`) trauma `0.8`.
- MAX only: `promoteTier(3)` fires at `at + 0.18` (`maxBeat`). At MAX the amount
  text itself pulses hard for the hold.

**Hold + staggered EXIT** (`exitAt = at + maxBeat + holdDur[T]`):
- `exitAt` `onMarqueeExit(true)` fires → music fades out *with* the visual exit.
- Staggered dismissal (not one flat fade):
  - plate + amount: alpha→0, `y += 26`, `0.40` (`power2.in`) at `exitAt`.
  - `WIN` band: alpha→0, `0.42` at `exitAt + 0.08`.
  - tier word: alpha→0, `y -= 18`, `0.45` at `exitAt + 0.14`.
  - coin rain: alpha→0, `0.55` at `exitAt`.
  - whole marquee drifts scale `×1.06` over `0.60`.
- On timeline complete → overlay destroyed, `play()` promise resolves (exactly once).

**Per-tier count/hold arrays and approximate total wall-clock:**

| Tier | `countDur` (s) | `holdDur` (s) | `tierScale` | `shake` px | `shakeRot` | ≈ total run (s) |
|---|---|---|---|---|---|---|
| BIG (0)  | 2.6 | 1.0 | 1.00 | 0 | 0 | ≈ 4.8 |
| MEGA (1) | 3.6 | 1.2 | 1.16 | 5 | 0.006 | ≈ 6.0 |
| EPIC (2) | 4.6 | 1.4 | 1.34 | 8 | 0.010 | ≈ 7.2 |
| MAX (3)  | 5.6 | 1.8 | 1.60 | 12 | 0.016 | ≈ 8.7 |

(Totals = `0.56 + countDur + maxBeat + holdDur + ~0.6 exit tail`.)

**Skip (player dismissal), `WinCelebration.skip()`:** kills the timeline and
compresses everything into a single clean fade of `0.26` (`power2.in`);
`onMarqueeExit(false)` fires → **fast** music fade. Safe at any time; no-op when
nothing is showing.

**Reduced motion:** static reveal (no stamp, no pulse, no coin rain, no shake),
hold `1.2`, `onMarqueeExit(true)`, fade `0.3`. Toggled by `params.reduced`.

---

## 4. Coin-rain overlay

A looping spritesheet layer rendered **behind** the marquee on every
celebration (skipped under reduced motion). It fades in over `0.35` on entrance
and out over `0.55` with the exit, cover-fits the canvas, and loops at its own
fps for the whole run. It is documented as its own addable feature — see
`dev-handoff/features/coin-rain/README.md`. Reference geometry: 3 sheets,
`10×10`, 300 frames total, 45 fps.

---

## 5. Win-marquee MUSIC

The celebration owns a dedicated, **exclusive** music track that starts and ends
with the marquee. It is a **theme-neutral** orchestral fanfare (one short 5-note
hook) — the same track in every game; theme colour comes only from the per-game
SFX, never from this track.

Wiring (`App.tsx` → `PixiApp.setMarqueeSoundHooks` → `WinCelebration`):

```ts
pixiApp.setMarqueeSoundHooks(
  () => {                                   // onMarqueeStart (marquee slam-in)
    soundManager.duck('ambient-music', 300);      // ambient ducks to silence (keeps running muted)
    soundManager.play('win-marquee');
  },
  smooth => {                               // onMarqueeExit(smooth) — fires exactly once
    soundManager.fadeStop('win-marquee', smooth ? 900 : 260);  // natural end vs. skip
    soundManager.unduck('ambient-music', smooth ? 700 : 400);  // ambient fades back in parallel
  },
);
```

Sound-event definition (`registries/soundEvents.ts` + `audio/defaultSoundConfig.ts`):

| Property | Value |
|---|---|
| Event id | `win-marquee` |
| File | `audio/win-marquee.ogg` (OGG-first; `.mp3` fallback) |
| Volume | `0.95` |
| Loop | `false` |
| Exclusive | `true` (a re-triggered celebration never stacks a 2nd copy) |
| Ducks ambient | `true` (ambient ducks on start, un-ducks on exit) |

Behaviour guarantees:
- Start fires on the marquee slam-in; exit fires **exactly once** (natural end →
  `smooth=true`, `900 ms` fade; skip/teardown → `smooth=false`, `260 ms` fade).
- The track never outlasts the marquee; ambient never restarts (it only ducks
  and un-ducks).
- Because the marquee owns the win audio at `r ≥ 15`, the per-win stingers
  (`win-small/normal/big/mega`) and `coin-chime` accents stay silent underneath.

---

## 6. Settings — `WIN_CELEBRATION_CONFIG`

Every tunable, verbatim from `src/game/WinCelebration.ts`. Array index =
tier `[BIG, MEGA, EPIC, MAX]`.

| Key | Value | Meaning |
|---|---|---|
| `minBigWin` | `15` | Below this x-bet ratio, no marquee plays at all |
| `bands.mega` | `25` | x-bet threshold to promote to MEGA (live) |
| `bands.epic` | `100` | x-bet threshold to promote to EPIC (live) |
| `words` | `['BIG WIN','MEGA WIN','EPIC WIN','MAX WIN']` | Fallback wordmarks (no art loaded) |
| `countDur` | `[2.6, 3.6, 4.6, 5.6]` | Count-up duration per tier (s) |
| `holdDur` | `[1.0, 1.2, 1.4, 1.8]` | Hold before exit per tier (s) |
| `wordFontSize` | `[46, 52, 58, 64]` | Fallback word size (px) |
| `amountFontSize` | `[46, 50, 54, 58]` | Fallback amount size (px) |
| `shake` | `[0, 5, 8, 12]` | Trauma-shake translation amplitude per tier (px) |
| `shakeRot` | `[0, 0.006, 0.01, 0.016]` | Trauma-shake rotation amplitude per tier (rad) |
| `sizeMul` | `0.48` | Overall marquee size multiplier (1 = full) |
| `tierScale` | `[1.0, 1.16, 1.34, 1.6]` | Each promotion grows the whole marquee to this factor |
| `pulseAmp` | `0.03` | Continuous per-layer pulse amplitude (scale) |

The MAX tier cap comes from the game config, not this object:
`config.maxWinMultiplier` (default `5000`), matched with epsilon `0.999`.

---

## 7. Generator-consumable JSON

```json
{
  "winMarquee": {
    "universal": true,
    "themeNeutral": true,
    "trigger": { "metric": "winMultiplier", "formula": "totalWin / wager" },
    "minMultiplier": 15,
    "bands": { "mega": 25, "epic": 100 },
    "maxTier": { "fromConfig": "maxWinMultiplier", "default": 5000, "epsilon": 0.999 },
    "countDur": [2.6, 3.6, 4.6, 5.6],
    "holdDur": [1.0, 1.2, 1.4, 1.8],
    "shake": [0, 5, 8, 12],
    "shakeRot": [0, 0.006, 0.01, 0.016],
    "sizeMul": 0.48,
    "tierScale": [1.0, 1.16, 1.34, 1.6],
    "pulseAmp": 0.03,
    "livePromotion": { "capTier": 2, "maxAfterCountBeatSec": 0.18 },
    "art": {
      "dir": "theme/win-tiers/",
      "canvas": { "w": 1920, "h": 1080 },
      "layers": {
        "big": "big.png", "mega": "mega.png", "epic": "epic.png",
        "max": "max.png", "win": "win.png", "plate": "plate.png"
      },
      "contentCyByTier": { "big": 0.2273, "mega": 0.2463, "epic": 0.2495, "max": 0.2269 },
      "winCy": 0.4875, "plateCy": 0.7681, "plateH": 0.374,
      "contentFrac": 0.911, "contentCy": 0.4995
    },
    "sound": {
      "event": "win-marquee",
      "file": "audio/win-marquee.ogg",
      "volume": 0.95,
      "loop": false,
      "exclusive": true,
      "ducksAmbient": true,
      "exitFadeMs": { "smooth": 900, "skip": 260 },
      "ambientDuckMs": 300,
      "ambientUnduckMs": { "smooth": 700, "skip": 400 }
    },
    "coinRain": {
      "sheets": ["theme/win-tiers/coinrain3_0.webp", "theme/win-tiers/coinrain3_1.webp", "theme/win-tiers/coinrain3_2.webp"],
      "cols": 10, "rows": 10, "count": 300, "fps": 45
    }
  }
}
```

## 8. Host integration points

| Call | Purpose |
|---|---|
| `pixiApp.setWinTierImages({ big, mega, epic, max, win, plate })` | Load the six aligned PNG layers (pass `null` → text fallback) |
| `pixiApp.setWinCoinRain(urls[], cols, rows, count, fps)` | Load the coin-rain sheets played behind the marquee (`null` → none) |
| `pixiApp.setMarqueeSoundHooks(onStart, onExit)` | Wire the exclusive music start/exit (see §5) |
| `WinCelebration.play({ winAmount, wager, symbol, decimals, tier, centre, origins, bounds?, reduced })` | Runs the celebration; resolves once |
| `WinCelebration.skip()` | Player dismissal → fast fade + fast music fade |
