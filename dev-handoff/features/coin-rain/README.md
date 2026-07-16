# Coin-Rain Overlay

A looping, full-canvas spritesheet layer that plays **behind the win marquee**
for the whole duration of a celebration. Pure cosmetic polish — no logic or RTP
impact. It is theme-agnostic: any game can add it by pointing the loader at its
own coin/particle sheets. (Reference skin "Vice Heat" uses green-gold coins.)

Reference implementation: `WinCelebration.setCoinRain()` in
`src/game/WinCelebration.ts`, wired via `PixiApp.setWinCoinRain()` and called
from `src/App.tsx`.

## Asset spec (reference skin)

| Property | Value |
|---|---|
| Sheets | `theme/win-tiers/coinrain3_0.webp`, `coinrain3_1.webp`, `coinrain3_2.webp` |
| Grid per sheet | `10 × 10` |
| Frames per sheet | `100` |
| Total frames (`count`) | `300` (across the 3 sheets, in order) |
| Playback | `45` fps, looped for the whole celebration |
| Transparency | RGBA alpha WEBP (green-screen keyed **offline**) |

Each sheet is a row-major grid. Frames are sliced with
`fw = sheetWidth / cols`, `fh = sheetHeight / rows`; frame `i` comes from sheet
`floor(i / 100)` at local cell `i % 100` — cell position
`((local % cols) * fw, floor(local / cols) * fh)`. Sheets are consumed in the
order passed; slicing stops early if `count` exceeds available cells.

## Runtime behaviour

- Added to the celebration overlay **before** the marquee, so it always renders
  behind the win screen.
- Cover-fits the canvas: anchored centre, `scale = max(screenW / fw, screenH / fh)`.
- Fades **in** over `0.35 s` (`power1.out`) on entrance and **out** over
  `0.55 s` (`power1.in`) with the marquee's staggered exit.
- Advances frames every tick at `fps` and loops modulo the frame count for the
  full run.
- **Disabled under reduced motion** (`params.reduced`) — it never spawns.
- On load, the sheets are warmed to the GPU (each raw source is large, ~140 MB)
  so the first celebration doesn't hitch on upload.

## Green-screen keying

The shipped WEBPs already carry alpha; the runtime just plays them. The keying
is done **offline** when producing the sheets. Reference parameters (from the
asset pipeline): chroma key `#00D300` with a **tight** key similarity of `0.13`
so the gold coin bodies stay fully opaque (yellow sits close to green in chroma
space — a looser key made the coins semi-transparent). A box-aspect crop plus
~1.42× upscale keeps them sharp. Reproduce these when re-keying a swapped sheet;
the runtime itself does no keying.

## How to swap the sheets / geometry

Call the loader with your own sheet URLs and grid numbers — nothing else changes:

```ts
pixiApp.setWinCoinRain(
  ["theme/win-tiers/coinrain3_0.webp",
   "theme/win-tiers/coinrain3_1.webp",
   "theme/win-tiers/coinrain3_2.webp"],
  10,   // cols
  10,   // rows
  300,  // total frame count (across all sheets, in order)
  45,   // fps
);
// Pass null to remove the overlay: pixiApp.setWinCoinRain(null, 0, 0, 0);
```

| Setting | Meaning | Ref value |
|---|---|---|
| `urls[]` | Sheets in playback order (row-major) | 3 sheets |
| `cols` | Columns per sheet | `10` |
| `rows` | Rows per sheet | `10` |
| `count` | Total frames to slice across all sheets | `300` |
| `fps` | Playback rate (default `30`) | `45` |

Rules of thumb when swapping:
- Keep every sheet the same pixel dimensions and the same `cols × rows` grid.
- Set `count` to the real number of authored frames (sheets in order); the
  loader stops at whatever cells exist.
- Supply alpha (transparent) WEBP; key any green-screen source offline first.
- A single sheet is fine — pass one URL and set `count` to its cell total.

## Generator-consumable JSON

```json
{
  "coinRain": {
    "sheets": [
      "theme/win-tiers/coinrain3_0.webp",
      "theme/win-tiers/coinrain3_1.webp",
      "theme/win-tiers/coinrain3_2.webp"
    ],
    "cols": 10,
    "rows": 10,
    "count": 300,
    "fps": 45,
    "framesPerSheet": 100,
    "renderOrder": "behind marquee",
    "coverFit": true,
    "fadeInSec": 0.35,
    "fadeOutSec": 0.55,
    "disabledUnderReducedMotion": true,
    "chromaKeyedOffline": { "color": "#00D300", "keySim": 0.13 }
  }
}
```
