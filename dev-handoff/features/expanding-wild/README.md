# Expanding Wild ("just add an image")

> Universal, theme-agnostic feature. **Vice Heat** (a 5x5 neon-motel slot) is only
> the reference skin — the mechanic works in any PixiJS ways/lines slot on any
> theme. Everything below is drawn from the live implementation in
> `src/game/ReelSet.ts` (`playExpandingWildReveal`, `expandOneWildReel`,
> `reelHasVisibleWild`) and `src/game/PixiApp.ts` (`setExpandingWildImage`).

---

## 1. What it does

When a **WILD** symbol lands anywhere in a reel's visible window, that whole
**reel column** turns fully wild: a single tall "tower" image grows out of the
landing cell and covers the entire column, top to bottom. This happens **before**
ways/lines evaluation, so the covered reel is treated as WILD in every row for
that spin.

- The expansion is **purely presentational** — it never rewrites the board data
  or the math outcome. The host/math layer independently overwrites the reel to
  all-WILD before evaluating (see `mockHost.ts`: `for (let row...) fsBoard[row][reel] = 0`).
  The visual and the settlement are two mirrors of the same rule.
- One reel expands at a time, **sequentially** — reel N finishes its full
  lock-in before reel N+1 starts (matches the reference cadence). Multiple reels
  can expand in one spin.
- Covered reels are added to an `expandedReels` set; while a tower stands, **all**
  other win presentation on that reel is suppressed — only the tower shows, and
  it pulses/thumps as the wild.

### When it runs

| Context | Behaviour |
|---|---|
| Free spins (3-scatter tier) | Every spin is an expansion pass; towers **clear each spin** (per-spin mode). |
| Hot spin (base game, 1-in-N) | Same per-spin expansion applied to a base spin. |
| Free spins (4+-scatter tier) | **Sticky** variant — see `../expanding-sticky-wild/`. Same visuals, towers persist. |

Candidate reels are only those whose strip actually carries a WILD. In the
reference math, reel 0 carries no wild by design, so it never expands. A reel
expands wherever the settled window naturally shows a wild (`reelHasVisibleWild`
/ `wildRowInWindow`) — with rare wilds, most spins expand nothing, and the plain
board still pays its natural connections. That organic pacing is the volatility.

---

## 2. The "just add an image" contract

**The dev supplies exactly ONE tall image** (the column art). The system
auto-scales and auto-crops it to the reel column — no per-grid slicing, no
frame atlas, no config beyond the file itself.

`PixiApp.setExpandingWildImage(url)` loads it as a texture and hands it to
`ReelSet.setExpandingWildTexture(tex)`. Pass `null` to clear (the effect then
falls back to a flat white panel).

### Auto-crop / auto-scale rule (exact)

From `expandOneWildReel`:

```
spr.anchor.set(0.5, 0)                       // center-x, TOP-anchored
spr.position.set(reelCenterX, reelColumnTopY)
spr.scale.set((reelColumnWidth * 0.98) / sourceImageWidth)   // UNIFORM scale
```

- **Width fits** to 98% of the reel-column width (a ~1.2px inset each side on a
  120px column). Scale is **uniform**, so height follows the source aspect ratio
  — the art is never stretched or squashed.
- **Top-anchored**: the tower head is always visible. If the scaled art is
  taller than the column, the **bottom crops off** (masked). If shorter, it
  leaves a gap at the bottom — so author the art at least as tall as the column
  aspect.
- The "grow" is a **reveal mask**, not a scale of the art: a rounded-rect mask
  expands from the landing cell outward (both up and down) until it equals the
  full column. The image sits still at full size behind the mask the whole time.

> **Design implication:** put the most important element (the "head" of the
> tower) in the TOP region of the source image. The bottom is what crops on
> shorter grids.

### Recommended source dimensions

Reel column geometry (measured): cell **120 x 110** px; reel column
**120 x 580** (5x5) / **120 x 348** (5x3). Reference art `wild_column.webp` is
**372 x 1904** RGBA (aspect ~1:5.12, a touch taller than the 5x5 column so its
base crops cleanly and the head stays safe).

| Grid | Reel column (px) | Column aspect | Recommended source PNG |
|---|---|---|---|
| 5x5 | 120 x 580 | ~1 : 4.83 | **372 x 1800–1904** (≈3.1x width for retina; the reference 372x1904 works as-is) |
| 5x3 | 120 x 348 | ~1 : 2.9 | **372 x 1080–1120** (same 372 width, height = width x column-aspect) |

Rule of thumb: **width ≈ 360–372 px** (3x the 120px cell, for crisp scaling) and
**height ≥ width x (reelColumnHeight / reelColumnWidth)** so the art fills to the
bottom. Any width works (the system width-fits), but higher resolution reads
sharper. One image can serve both grids if its aspect is ≥ the tallest column
(5x5); on 5x3 the extra bottom simply crops.

---

## 3. The opening effect (exact tween)

One reel's expansion, from `expandOneWildReel(reelIdx, row, turbo)`. All
durations scale by `speed = turbo ? 0.6 : 1`. Corner radius `rad = 14`. Phase
offsets: `T_CLEAR = 0.32*speed`, `T_RACE = 0.40*speed`, `T_LOCK = T_RACE + 0.46*speed`.

| # | Beat | Timing (normal, speed=1) | Tween |
|---|---|---|---|
| 0 | Fire `onWildExpand(reelIdx)` sound | t=0 | bill-riffle riser; its slam is authored to land on lock-in (~0.42s) |
| 1 | **Wild lands** in the cell (`popOneStickyWild`, no cell-shine) | t=0 | opaque backing panel + WILD tile pop: `alpha 0→1` 0.12s `power1.out`; `scale 0→x1.18` 0.16s `back.out(3)`; settle `→x1` 0.18s `power2.out`; additive flash `alpha 0→0.6` 0.08s then `→0` 0.30s |
| 2 | **Clear-beat** opaque panel fades over the reel | starts 0.32s, 0.12s | `clear.alpha 0→1`, `power2.out` (hides the still-rolling reel) |
| 3 | Tower sprite fades in | starts 0.38s, 0.07s | `spr.alpha 0→1`, `power1.out` |
| 4 | **Race out** — reveal mask grows from the landing cell in BOTH directions to fill the column | 0.40s → 0.86s (0.46s) | `reveal.t 0→1`, `expo.inOut` (gathers momentum, glides in — no hard snap) |
| 5 | **Lock-in squash** — column compresses under its own weight | at 0.86s, 0.08s | `spr.y → top+6` & `spr.scale.y → base*0.972`, `power3.out` |
| 6 | **Spring back** (elastic settle) | from 0.94s, 0.55s | `spr.y → top` & `spr.scale.y → base`, `elastic.out(1, 0.4)` |
| 7 | **Impact flash** washes the column | at 0.86s: 0.05s up, then 0.26s decay | `flash.alpha 0→0.7` `power2.out` → `→0` `power2.in`, additive blend |
| 8 | **Board slam** (whole board takes the hit) | at 0.86s | `playLandingThud(lastReel)` — hard elastic settle on the board container |
| 9 | **Shine border** ignites around the whole reel | at 0.86s | reel-sized AAA shine (`applyStickyWild(reelRect)`) |
| 10 | Control handed back (next reel may start) | at 1.02s | `T_LOCK + 0.16*speed` |
| 11 | Tower starts **breathing** (idle life) | at 1.54s | `T_LOCK + 0.68*speed` → `startTowerIdle` |

**Reveal-mask math** (`drawReveal(t)`): the visible window interpolates from
exactly the landing cell at `t=0` to the full reel column at `t=1`:
```
topY = cellTop     + (reelTop     - cellTop)     * t
botY = cellBottom  + (reelBottom  - cellBottom)  * t
mask = roundRect(reelX-1, topY, reelW+2, botY-topY, 14)
```
So the tower appears to erupt out of the landing cell and race to both ends of
the column simultaneously.

**Idle breathing** (`startTowerIdle`, once settled): two incommensurate
sine yoyos so the loop never reads as mechanical — `scale.y` to `base*1.007`
over 1.7s, `scale.x` to `base*1.004` over 2.45s, each phase-shifted at random.
No y-bob (the reveal mask would crop the head).

---

## 4. Sounds (by event id)

Referenced by event id only — the audio pack is theme-specific, the events are
universal (`src/registries/soundEvents.ts`).

| Event id | Fires | Reference character |
|---|---|---|
| `wild-land` | a wild becomes visible on reel stop (`onWildLanded`) | cash-bundle drop: thud + bill flaps |
| `wild-expand` | the expansion reveal starts, at t=0 (`onWildExpand`) | accelerating bill-riffle riser into a fat slam; the slam is authored to hit the lock-in beat (~0.42s) |

Default mix volumes: `wild-land` 0.8, `wild-expand` 0.85
(`src/audio/defaultSoundConfig.ts`).

---

## 5. Settings

| Key | Type | Default | Meaning |
|---|---|---|---|
| `columnArt` | image url / null | null | The one tall column PNG/WEBP. null → flat white-panel fallback. |
| `widthFitFactor` | number | 0.98 | Fraction of reel-column width the art fits to (uniform scale). |
| `anchor` | enum | `top-center` | Art anchor; top-anchored so the head never crops. |
| `cornerRadiusPx` | number | 14 | Rounded-rect radius for clear-beat, mask, flash. |
| `tClearSec` | number | 0.32 | Clear-beat start offset. |
| `tRaceSec` | number | 0.40 | Race-out (mask grow) start offset. |
| `raceDurationSec` | number | 0.46 | Mask-grow duration, `expo.inOut`. |
| `lockSquashSec` | number | 0.08 | Squash duration, `power3.out`. |
| `lockSettleSec` | number | 0.55 | Elastic spring-back, `elastic.out(1,0.4)`. |
| `turboSpeed` | number | 0.6 | Global time multiplier in turbo. |
| `sequential` | bool | true | One reel finishes before the next expands. |
| `sound.onLand` | event id | `wild-land` | Wild-landed foley. |
| `sound.onExpand` | event id | `wild-expand` | Expansion riser+slam. |

See `feature.json` in this folder for the machine-readable form.

---

## 6. Integration points (source of truth)

- `PixiApp.setExpandingWildImage(url: string | null)` — load/clear the column art.
- `ReelSet.setExpandingWildTexture(tex: Texture | null)` — receives the texture.
- `ReelSet.playExpandingWildReveal({ isLive, turbo, sticky?, force? })` —
  orchestrates the spin + per-reel expansions; returns the expanded reel indices.
- `ReelSet.expandOneWildReel(reelIdx, row, turbo)` — the single-reel opening
  effect documented in §3.
- `ReelSet.reelHasVisibleWild(reelIdx, stop)` — gate for which reels expand.
- Audio hooks: `ReelSetAudioHooks.onWildLanded`, `.onWildExpand`.
