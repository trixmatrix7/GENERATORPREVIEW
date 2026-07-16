# Frame Win Flash — Cabinet lights up on the trigger

**Type:** grid effect (needs render code, data-driven placement) · **Grids:** 5x3, 5x5 · **Theme-agnostic.**

Reference skin: *Vice Heat* (a neon palm sign whose marquee bulbs chase and whose arrow strobes). The mechanic is universal: a one-shot animated overlay, chroma-matted to alpha, plays a lit-up version of the game frame the instant the trigger completes.

---

## What it is

The decorative frame around the reels (the cabinet art) has a matching **"lit" spritesheet** — the same frame with its lights on, animated. It plays exactly once, the moment the **3rd scatter lands** (i.e. the free-spins trigger is confirmed), as a celebratory punctuation synced to the trigger beat. It is purely cosmetic (no RTP impact) and self-clears.

The flash sprite is placed with a **region rectangle** that says *where the animated crop sits inside the frame texture*, so it rides the exact same texture→screen mapping as the static frame art. Wherever the frame image is drawn (position, scale), the flash lands pixel-aligned on top of it. The overlay is added above the frame art (in `gameContainer`) and destroyed on completion.

---

## Trigger

Counted off the reel layer's scatter-landed callback, not off the final board (so it fires the instant the decisive scatter physically lands):

```
on each scatter landed:  scatterLands++
  if scatterLands === 3:  playFrameWinFlash()
```

`scatterLands` resets to `0` on every `spin()` (and at each phase reset). Because it counts landings, a board that settles with 4+ scatters still flashes once, on the 3rd.

---

## Sheet geometry & placement

Frames are sliced **row-major** from the sheet: `fw = sheet.width / cols`, `fh = sheet.height / rows`, frame `i` at `((i % cols) * fw, floor(i / cols) * fh, fw, fh)`, for `count` frames.

Reference asset `frame_win_flash_1.webp`:

| Property | Value |
|---|---|
| Sheet size | 2064 × 3468 px |
| Grid | 8 cols × 6 rows |
| Frame size | 258 × 578 px |
| Frames used | 48 |
| fps | 12 (→ ~4.0 s run) |
| `region` (crop inside the frame texture) | `{ x: 1025, y: 225, w: 475, h: 1062.5 }` |

**Placement math** (against the frame image sprite `fi`):
```
sprite.position = ( fi.x + region.x * fi.scale.x,  fi.y + region.y * fi.scale.y )
sprite.width    = region.w * fi.scale.x
sprite.height   = region.h * fi.scale.y
```
The `region` is the lit-frame crop measured in the frame texture's own pixels — only the light-emitting part of the frame is redrawn, not the whole 1500² cabinet.

**Play timeline** (GSAP): fade in `alpha 0→1, 0.12 s, sine.out`; advance frame index `0 → count-1` over `count / fps` s, `ease none`; fade out `alpha → 0, 0.35 s, sine.in` starting at `max(0.2, dur - 0.3)`. On complete the sprite is removed and destroyed.

---

## Settings

| Setting | Default | Meaning |
|---|---|---|
| `file` | — | Chroma-matted lit-frame spritesheet |
| `cols` | `8` | Sheet columns |
| `rows` | `6` | Sheet rows |
| `count` | `48` | Frames actually used (≤ cols×rows) |
| `fps` | `12` | Playback rate |
| `region` | `{x,y,w,h}` | Crop **inside the frame texture** where the frames live |
| `triggerScatterCount` | `3` | Which scatter landing fires it |
| `fadeIn` / `fadeOut` | `0.12 s` / `0.35 s` | Envelope |

### feature.json

```json
{
  "id": "frame-win-flash",
  "name": "Frame Win Flash",
  "description": "A one-shot lit-frame spritesheet (chroma-matted to alpha) plays over the reel frame the instant the trigger scatter lands, riding the frame art's own texture→screen mapping so it stays pixel-aligned at any scale. Cosmetic, self-clearing.",
  "version": "1.0.0",
  "implemented": true,
  "compatibleGrids": ["5x3", "5x5"],
  "type": "grid-effect",
  "scope": "full-grid",
  "trigger": "3rd scatter landed",
  "intensity": "strong",
  "asset": {
    "file": "theme/<skin>/frame_win_flash_1.webp",
    "cols": 8,
    "rows": 6,
    "count": 48,
    "fps": 12,
    "region": { "x": 1025, "y": 225, "w": 475, "h": 1062.5 }
  },
  "settings": {
    "triggerScatterCount": 3,
    "fadeIn": 0.12,
    "fadeOut": 0.35
  }
}
```

---

## Render wiring (exact call sites — `src/game/PixiApp.ts`)

- `setFrameWinFlash(url, cols=8, rows=6, count=48, fps=12, region)` — loads the sheet, slices `count` frames row-major, stores `{ frames, fps, region }`. `url=null` clears it. **A `region` is required** — without it the flash is inert.
- `playFrameWinFlash()` — builds the sprite, places it via the frame-sprite mapping above, runs the fade-in / frame-advance / fade-out timeline, self-cleans on complete. No-op if not live, no frames loaded, no frame image, or no region.
- `stopFrameFlash()` — kills the timeline and destroys the sprite (called on re-arm and teardown).
- **Trigger count** lives in `setAudioHooks(...)`, which wraps the reel layer's `onScatterLanded` to `scatterLands++; if (scatterLands === 3) playFrameWinFlash()`. `scatterLands` resets to `0` in `spin()`.

**Wiring from the app config — `src/App.tsx`:**
```ts
void pixiAppRef.setFrameWinFlash(
  `${B}frame_win_flash_1.webp`, 8, 6, 48, 12, { x: 1025, y: 225, w: 475, h: 1062.5 },
);
```

---

## How to add it to a new game

1. Author a lit version of the frame as a chroma-keyed spritesheet (green screen → alpha) — only the light-emitting crop needs to animate.
2. Measure the `region` rectangle: the crop's `{x,y,w,h}` in the **frame texture's own pixel space**.
3. Call `setFrameWinFlash(url, cols, rows, count, fps, region)` once at boot.
4. The existing 3rd-scatter counter fires it automatically. To change the trigger, adjust the `=== 3` gate in the scatter-landed wrapper.
