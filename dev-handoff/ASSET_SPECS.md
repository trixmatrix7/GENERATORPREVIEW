# ASSET SPECS — definitive asset specification

This document tells a slot generator **exactly how to load, slice, place, and scale every visual asset** for a 5×5 (or 5×3) PixiJS ways-pays slot. Everything here is theme-agnostic: the reference skin is **Vice Heat** (Miami-motel / beach-club), but every rule works for any skin — swap the art files, keep the geometry and the slicing contract.

All numbers below were read from the live runtime source, not invented:
- Slicing / fitting logic: `src/game/PixiApp.ts` (`setFrameImage`, `setBackgroundSpritesheet`, `setSymbolWinSheet`, `setSymbolIdleSheet`, `setFrameWinFlash`, `setWinCoinRain`, `setLayeredIntro`) and `src/game/ReelSet.ts` (`expandOneWildReel`).
- Geometry constants: `src/config/gridConfig.ts`, `src/game/symbolMetrics.ts`, `src/config/symbolSizing.ts`, and the layout constants at the top of `src/game/PixiApp.ts` (`FRAME_PAD = 28`, `HEADER_H = 52`, `SCENE_MARGIN = 40`).
- Wiring / parameters: `src/App.tsx` boot block and `src/studio/buildPresets.ts` `assets` block.
- Intro layout: `src/data/introLayers.json`.
- Pixel dimensions in the tables were re-measured from the shipped files in `public/theme/`.

---

## 0. Folder layout (reference skin)

```
public/theme/<skin>/            e.g. public/theme/vice/
  symbol_*_landing.png          9 static symbol icons (512×512 RGBA)
  *_win.webp                    per-symbol win spritesheets
  scatteridle.webp scatterwin.webp   scatter idle + win sheets
  wild_column.webp              expanding-wild tower art
  frame_neon.webp               reel frame (transparent centre window)
  frame_win_flash_1.webp        frame win-flash spritesheet
  bg_motel.webp                 static base background
  bg_motel_anim_1/2/3.webp      animated base background (3-sheet loop)
  fsbg_beachclub.webp           static free-spins background
  fsbg_beachclub_anim_1/2/3.webp animated FS background (3-sheet loop)
  logo.webp                     title logo above the grid
  intro/game|fs3|fs4|outro/*    layered intro-screen art
public/theme/win-tiers/         SKIN-NEUTRAL, shared across all games
  big|mega|epic|max|win|plate.png    win-marquee layers (1920×1080)
  coinrain3_0/1/2.webp          coin-rain spritesheets
```

The generator should treat `public/theme/<skin>/` as the per-game art bundle and `public/theme/win-tiers/` as a shared, theme-neutral bundle reused by every game.

---

## 1. Grid geometry (the coordinate system every asset maps into)

Source: `src/config/gridConfig.ts` (`DEFAULT_CELL_METRICS`, `buildLayout`) and `src/game/symbolMetrics.ts`.

| Constant | Value | Meaning |
|---|---|---|
| `symbolWidth` (cell W) | **120 px** | one cell / one reel column width |
| `symbolHeight` (cell H) | **110 px** | one cell height (art footprint) |
| `symbolGap` | **6 px** | vertical gap; each row *owns* its bottom gap |
| `reelGap` | **8 px** | horizontal gap between reels |
| `FRAME_PAD` | **28 px** | inset from the machine box to the reel window (frame art maps its window onto this inner rect) |
| `HEADER_H` | **52 px** | header strip above the grid |
| `SCENE_MARGIN` | **40 px** | outer margin around the whole scene |

**Derived layout** (cellHeight = symbolHeight + symbolGap = **116 px**):

| | reels × rows | grid width | grid height = **reel column height** |
|---|---|---|---|
| **5×5** | 5 × 5 | 5·120 + 4·8 = **632** | 5·116 = **580** |
| **5×3** | 5 × 3 | **632** | 3·116 = **348** |

- Horizontal: `width = reelCount·symbolWidth + (reelCount−1)·reelGap` — gaps live *between* reels.
- Vertical: `height = visibleRows·(symbolHeight + symbolGap)` — every row owns its bottom gap.
- A single reel column footprint is therefore **120 × 580** (5×5) or **120 × 348** (5×3). This is the crop target for the expanding-wild tower (§6).

The active grid is a runtime singleton (`setActiveGrid(GRID_5x5 | GRID_5x3)`); the same engine and the same art render both. Only `visibleRows` (and therefore the reel column height) changes.

---

## 2. Spritesheet slicing contract (read this before the tables)

Every animated asset is a **row-major grid of equal frames** packed into one texture (or a chain of textures). The runtime slices it identically everywhere:

```
fw = sheet.width  / cols      // per-frame width
fh = sheet.height / rows      // per-frame height
for i in 0 .. count-1:
    frame[i] = Rectangle( (i % cols) * fw,          // x
                          floor(i / cols) * fh,     // y
                          fw, fh )
```

Rules the generator must honour:

1. **Row-major order.** Frame 0 is top-left; index advances left→right, then wraps to the next row down. `x = (i % cols)·fw`, `y = floor(i / cols)·fh`.
2. **`count` can be < cols×rows.** The sheet is padded to a full rectangle for encoding, but only the first `count` cells are real frames. Trailing cells (indices `count … cols·rows−1`) are **unused padding** and must never be shown. Example: `prem_a_win.webp` is a 7×7 = 49-cell grid but `count = 48`, so the very last (bottom-right) cell is padding.
3. **Multi-sheet chaining** (backgrounds, coin rain): pass an **array** of sheet URLs. `perSheet = cols·rows`; global frame `i` lives in sheet `floor(i / perSheet)` at local index `i % perSheet`. Total `count` may span sheets so the loop can exceed a single-texture size limit. `count` defaults to `perSheet × sheets.length` when omitted. If `count` exceeds the frames actually supplied, the loop stops at what exists.
4. **Playback.** Frames advance on a delta-time accumulator: `accum += dt; while (accum ≥ 1/fps) { idx = (idx+1) % count; accum -= 1/fps }`. A modest sheet fps therefore reads as continuous motion, decoupled from the render framerate.
5. **Cross-fade (backgrounds only).** A second sprite carries frame `idx+1` at `alpha = accum / (1/fps)`, so consecutive frames dissolve into each other instead of hard-stepping — a 6 fps sheet looks smooth.
6. **Per-frame px are implicit** — the runtime derives them from `sheetW/cols` and `sheetH/rows`. The generator should author sheets whose total dimensions divide cleanly by `cols`/`rows` so frames land on integer boundaries.

---

## 3. SPRITESHEET table (every sheet, exact geometry)

| Asset file | Purpose | Total px | Cols×Rows | Frames used | Per-frame px | fps | Region / notes |
|---|---|---|---|---|---|---|---|
| `prem_a_win.webp` | highA (id 2) win loop | 1792×1792 | 7×7 | **48** / 49 | 256×256 | 12 | last cell padding |
| `prem_b_win.webp` | highB (id 3) win loop | 1792×1792 | 7×7 | **48** / 49 | 256×256 | 12 | last cell padding |
| `car_win.webp` | midC (id 4) win loop | 1792×1792 | 7×7 | **48** / 49 | 256×256 | 12 | last cell padding |
| `koffer_win.webp` | midD (id 5) win loop | 1792×1792 | 7×7 | **48** / 49 | 256×256 | 12 | last cell padding |
| `scatterwin.webp` | scatter (id 1) win burst | 2048×2304 | 8×9 | **67** / 72 | 256×256 | 15 | 5 trailing cells padding; plays once at FS trigger |
| `scatteridle.webp` | scatter (id 1) idle loop | 2560×2304 | 10×9 | **90** / 90 | 256×256 | 10 | full grid, seamless 9 s loop; replaces static art on board |
| `frame_win_flash_1.webp` | frame marquee bulb-chase | 2064×3468 | 8×6 | **48** / 48 | 258×578 | 12 | full grid; one-shot. **`region` = placement inside the FRAME texture (1500² space), not inside this sheet:** `{x:1025, y:225, w:475, h:1062.5}` |
| `bg_motel_anim_1/2/3.webp` | animated base bg | 3328×1872 each | 4×4 | **45** total across 3 | 832×468 | 6 | 3 sheets (16+16+13); sheet 3 uses 13 of 16 cells; cross-faded loop |
| `fsbg_beachclub_anim_1/2/3.webp` | animated FS bg | 3328×1872 each | 4×4 | **48** total across 3 | 832×468 | 6 | 3 sheets × 16 = full; cross-faded loop |
| `coinrain3_0/1/2.webp` | win-marquee coin rain | 6400×5520 each | 10×10 | **300** total across 3 | 640×552 | 45 | 3 sheets × 100 = full; chroma-keyed alpha, plays behind marquee |

Notes:
- **Win sheets** (`*_win.webp`, `scatterwin.webp`) loop **in place of the static symbol art** while that cell is part of a winning connection, then hand back to the static art. `setSymbolWinSheet(symbolId, url, cols, rows, count, fps)`.
- **Idle sheets** (`scatteridle.webp`) **permanently replace** the static art on the resting board; the win sheet takes over during a win and hands back. `setSymbolIdleSheet(symbolId, url, cols, rows, count, fps)`.
- WILD (id 0) has **no** win sheet in the reference skin; the scatter uses idle+win and *no* landing/idle squash (it's flagged `staticLook`).
- The **frame win flash** `region` is the single most-confused value: it is measured in the **frame texture's own pixel space** (the 1500×1500 `frame_neon.webp`), marking where the lit palm-marquee crop sits. At play time the flash sprite is positioned at `frameSprite.x + region.x·frameScale.x` and sized `region.w·frameScale.x × region.h·frameScale.y`, so it rides the exact same window-mapping as the frame art.

---

## 4. SYMBOL table (static icons)

Source: `src/config/symbols.ts`, `src/config/viceAssets.ts`, `src/game/AnimatedSymbol.ts`, `src/config/symbolSizing.ts`.

Each symbol is a **512×512 RGBA PNG**, a single centred icon on full transparency (no baked background, no caption). File naming: `symbol_<key>_landing.png`.

| SymbolId | key | reference art | file |
|---|---|---|---|
| **0** | WILD | money-stack "W" | `symbol_wild_landing.png` |
| **1** | SCATTER | BONUS badge | `symbol_scatter_landing.png` |
| **2** | HIGH_A | premium A | `symbol_high_a_landing.png` |
| **3** | HIGH_B | premium B | `symbol_high_b_landing.png` |
| **4** | MID_C | mid C | `symbol_mid_c_landing.png` |
| **5** | MID_D | mid D (money case) | `symbol_mid_d_landing.png` |
| **6** | LOW_E | low E | `symbol_low_e_landing.png` |
| **7** | LOW_F | low F | `symbol_low_f_landing.png` |
| **8** | LOW_G | low G | `symbol_low_g_landing.png` |
| (9) | COIN | *(no supplied art — falls back to a themed placeholder glyph; inert money symbol)* | — |

The SymbolId map **must** match the math manifest and the on-chain contract. Ids 0–8 carry art; id 9 (COIN) is optional and un-arted in this skin.

### How a 512×512 icon scales into the 120×110 cell

The icon is drawn as a **square sprite, anchor 0.5, centred in the cell**, tinted white (untouched). Its side length is computed as (`AnimatedSymbol.ts`, `isUserAsset` path):

```
baseTargetSize = round( min(cellW, cellH) · 0.72 )       // = round(110·0.72) = 79
perSymbolMul   = isScatter ? 1.2 : 1.0                    // scatter reads bigger
targetSize     = round( baseTargetSize · objectScale · perSymbolMul )
iconSprite.width = iconSprite.height = targetSize        // square, centred
```

`objectScale` comes from the **`symbolSize` preset** (`SYMBOL_SIZE_PRESETS` in `symbolSizing.ts`). The reference build ships **`large` (1.3)** as the default because the stock art sits a touch small in the cell:

| preset | objectScale | normal symbol side | scatter side (×1.2) |
|---|---|---|---|
| `normal` | 1.0 | 79 px | 95 px |
| **`large` (default)** | **1.3** | **103 px** | **123 px** |
| `xl` | 1.6 | 126 px | 152 px |

So at the default `large` preset a normal symbol icon is a **103×103** square inside the 120×110 cell (~72% × 1.3 fill), and the scatter is **123×123** — deliberately slightly larger than the cell for presence. The cell tile/backing is unchanged; only the art object grows. Swap via `PixiApp.applyVisualParam('symbolSize', key)`, which sets `symbolSizing.objectScale` and re-draws every tile.

---

## 5. Symbol WIN / IDLE sheet placement

Win and idle sheets replace the static icon **on the cell's resting footprint** (the same 120×110 cell rect), sliced per §2. The generator wires them by SymbolId:

```jsonc
"winSheets": {
  "1": { "file": "scatterwin.webp", "cols": 8, "rows": 9, "count": 67, "fps": 15 },
  "2": { "file": "prem_a_win.webp", "cols": 7, "rows": 7, "count": 48, "fps": 12 },
  "3": { "file": "prem_b_win.webp", "cols": 7, "rows": 7, "count": 48, "fps": 12 },
  "4": { "file": "car_win.webp",   "cols": 7, "rows": 7, "count": 48, "fps": 12 },
  "5": { "file": "koffer_win.webp","cols": 7, "rows": 7, "count": 48, "fps": 12 }
},
"idleSheets": {
  "1": { "file": "scatteridle.webp", "cols": 10, "rows": 9, "count": 90, "fps": 10 }
},
"staticLookSymbols": [1],   // scatter: no landing/idle squash (win sheet is its only motion)
"noIdleSymbols":     [0]    // wild: hard landing slam but no fallback idle breathing
```

---

## 6. EXPANDING-WILD tower source-image spec

Source: `ReelSet.expandOneWildReel` (`src/game/ReelSet.ts`) + `PixiApp.setExpandingWildImage`.

The tower is **one tall RGBA image** — the vertical W‑I‑L‑D column that fills a whole reel. Reference: `wild_column.webp` = **372×1904 RGBA**.

### Fit / crop rule (exact)

The sprite is **width-fit to 98% of the reel width, top-anchored, and masked to the reel column**. It is *not* height-fit and *not* stretched:

```
spr.anchor = (0.5, 0)                          // top-centre
spr.position = (reelCentreX, reelTopY)          // top aligned with the reel top
spr.scale   = (reelW · 0.98) / tex.width        // WIDTH fit
mask        = the reel column rect (reelW × reelColumnHeight)
```

The reveal grows a mask outward from the landing cell; at full extension the mask equals the whole reel column, so the sprite is clipped to the reel footprint. **The head (top) always shows; only the stack base may crop at the bottom.** The art never stretches or shifts.

### Concrete numbers for the reference art (372×1904)

```
scale         = (120 · 0.98) / 372 = 117.6 / 372 = 0.3161
rendered W    = 117.6 px
rendered H    = 1904 · 0.3161 = 601.9 px  (top-anchored at reel top)
```

| grid | reel column height (mask) | shown | cropped at base |
|---|---|---|---|
| **5×5** | 580 px | top 580 of 601.9 (~96%) | ~22 px |
| **5×3** | 348 px | top 348 of 601.9 (~58%) | ~254 px |

### Auto-crop / authoring rule for your own tower

Provide a tall RGBA image such that, after width-fit to ~117.6 px, its rendered height **covers the reel column**:

```
rendered H = imgHeight · (117.6 / imgWidth)  ≥  reelColumnHeight
⇒ aspect (imgHeight / imgWidth) ≥ 580/117.6 = 4.93   for 5×5
⇒ aspect (imgHeight / imgWidth) ≥ 348/117.6 = 2.96   for 5×3
```

The reference `wild_column.webp` aspect is 1904/372 = **5.12**, which satisfies both (it slightly over-hangs the 5×5 column and over-hangs the 5×3 column more — that extra base simply crops).

**Two valid authoring strategies:**
- **Exact-column aspect** (no waste): author the tower to the reel column aspect. 5×5 column is 120:580 ⇒ e.g. **512×2475**; 5×3 column is 120:348 ⇒ e.g. **512×1484**. Nothing crops.
- **Over-tall / grid-agnostic** (reference approach): author one tall image (aspect ≥ 4.93) and let the base crop per grid. **Front-load the meaningful content (the W‑I‑L‑D lettering / head) into the top** — on 5×3 only the top ~58% of the image is visible, so anything in the bottom will be cut. Keep the whole strip centred horizontally (the 0.5 anchor centres it in the 120 px reel).

Set with `setExpandingWildImage(url)`; pass `null` to fall back to a flat panel.

---

## 7. ANIMATED BACKGROUND spec (3-sheet cross-faded loop)

Source: `PixiApp.setBackgroundSpritesheet` + the base/FS boot calls in `App.tsx`.

A base (and a separate FS) background is a **static image painted instantly, then a spritesheet loop takes over**:
- Static: `bg_motel.webp` / `fsbg_beachclub.webp` — nominal **1920×1080** (reference `bg_motel.webp` is 1920×1072, `fsbg_beachclub.webp` 1920×1080). Cover-fit to the renderer.
- Loop: an **array of 3 sheets**, each **3328×1872**, **4×4**, **832×468 per frame**, **fps 6**, cross-faded.

Parameters (see §2 for slicing/cross-fade math):

| Loop | sheets | cols×rows | total frames | per-frame px | fps |
|---|---|---|---|---|---|
| base (`bg_motel_anim_1/2/3`) | 3 | 4×4 | **45** | 832×468 | 6 |
| FS (`fsbg_beachclub_anim_1/2/3`) | 3 | 4×4 | **48** | 832×468 | 6 |

How the generator slices it: concatenate the 3 sheets logically (`perSheet = 16`); global frame `i` → sheet `floor(i/16)`, local `i%16`, then row-major within that sheet. For the base loop `count = 45`, so sheet 3 contributes only its first 13 cells (16+16+13); the remaining 3 cells are padding. The FS loop `count = 48` is exactly full. Each advance cross-fades into the next frame so 6 fps reads as continuous water/palm/crowd motion. The loop must be **seamless** (frame `count−1` → frame 0).

The animated bg reuses the static-bg pipeline (cover-fit + frosted reel backdrop). During the FS round the ticker swaps to the FS frames automatically.

---

## 8. FRAME image spec (alpha-window auto-detect + overhang)

Source: `PixiApp.setFrameImage` (`src/game/PixiApp.ts`).

The reel frame is a **single square RGBA image with a transparent centre window** so the reels show through. Reference: `frame_neon.webp` = **1500×1500**, explicit window `{x:197, y:314, w:832, h:832}`.

### Window mapping

The frame's transparent **window rect (in texture px)** is mapped exactly onto the **inner reel rect** (the machine box inset by `FRAME_PAD = 28`):

```
sx = (frameW − FRAME_PAD·2) / window.w
sy = (frameH − FRAME_PAD·2) / window.h
sprite.scale    = (sx, sy)
sprite.position = (FRAME_PAD − window.x·sx, FRAME_PAD − window.y·sy)
```

So the neon tube sits flush on the slot window, and any decoration **outside** the window (palm, marquee arrow) hangs over the background instead of covering the reels.

### Alpha-window auto-detect (when no window is supplied)

If the caller passes no `frameWindow`, the runtime extracts the texture's pixels and auto-detects the hole:

1. Read the **centre pixel** alpha. If it's transparent (`alpha ≤ 16`) there is a centre hole; otherwise the whole texture stretches (legacy behaviour).
2. From the centre, walk **up / down / left / right** along the centre row and column; the first pixel with `alpha > 16` in each direction bounds the transparent window.
3. Accept the window only if it's larger than **20% of the texture** in both dimensions (guards against noise).

### Overhang (keeps decorations on-canvas)

With a window known, the runtime scans every 2nd row for the min/max opaque x to find art that extends **beyond the window horizontally**:

```
ovL = max(0, window.x − minOpaqueX)          // left overhang, texture px
ovR = max(0, maxOpaqueX − (window.x+window.w)) // right overhang, texture px
frameArtOvL = max(0, ovL·sx − FRAME_PAD)       // → design px, drives layout
frameArtOvR = max(0, ovR·sx − FRAME_PAD)
```

The scene then re-fits so the overhanging side (e.g. the marquee arrow) never clips at the canvas edge.

**Authoring your own frame:** square RGBA (reference 1500²), fully transparent rectangular centre window, decorations painted into the opaque border and allowed to spill left/right of the window. Either pass the exact window rect, or rely on auto-detect (make the centre pixel genuinely transparent and the hole > 20% of the image). `null` clears the frame.

---

## 9. WIN-TIER marquee + coin rain (shared, theme-neutral)

Source: `PixiApp.setWinTierImages`, `PixiApp.setWinCoinRain`, `App.tsx`.

- **Marquee layers** live in `public/theme/win-tiers/` and are **shared by every game** (theme-neutral): six **1920×1080 PNGs** — `big.png`, `mega.png`, `epic.png`, `max.png` (tier headlines), `win.png` (the "WIN" word), `plate.png` (the amount plate). These are static layered images composited by the celebration, not spritesheets. Pass as `{ big, mega, epic, max, win, plate }` URLs; `null` falls back to baked text.
- **Coin rain**: 3 chroma-keyed spritesheets `coinrain3_0/1/2.webp`, **6400×5520 each, 10×10, 640×552 per frame, 300 frames total, fps 45**, played behind the marquee. Sliced/chained exactly per §2. Green-screen keyed to alpha at load.

---

## 10. INTRO layer spec (element-centred, 1920×1080 design space)

Source: `PixiApp.setLayeredIntro` (`src/game/PixiApp.ts`) + `src/data/introLayers.json`.

Intro screens are **stacks of individually-positioned WEBP/PNG layers** in a **1920×1080 design space** (origin at centre `960,540`). Each layer is an element-centred export placed by its centre point:

```
sprite.anchor   = 0.5
sprite.position = (cx − 960, cy − 540)        // design-space centre → centre-origin
sprite.scale    = tw ? (tw / tex.width) : 1   // tw = target width in design px
```

So `cx`,`cy` are the layer's **centre** in the 1920×1080 canvas, and optional `tw` is the **target rendered width** (design px) — the export is scaled so `renderedWidth = tw`, preserving aspect. Without `tw` the layer renders at native px. The whole design space cover-fits the canvas (`scale = max(sw/1920, sh/1080)`), with contain-fit fallbacks for portrait phones.

### Layer roles and motion

| `role` | motion | notes |
|---|---|---|
| `bg` | slow drift + breathe, rests ~1.8% above cover | full-screen background. **The `game` set skips its `bg`** — the live animated base background shows through instead. |
| `card` | **static** | anchors the composition (the 3-card band); captions are static too |
| `symbol` | vertical float only (no scale/rotate) | in-place warping pixelates upscaled art, so it only bobs |
| `logo` | float + gentle breathe + micro-rotate | the **biggest** logo becomes the "hero" and gets a stronger sway |
| `press` | alpha + scale pulse ("press to continue") | |
| `text` / default | **fully static** | floating captions read as warped pixels and drift out of their boxes |

### The four intro sets (from `introLayers.json`)

| set | when | contents (reference) |
|---|---|---|
| `game` | game start | title logo, 3-card feature band (STICKY / BONUS / MAX), feature logos + symbols + text, press-to-continue. **No baked bg.** |
| `fs3` | 3-scatter FS intro | bg, single centred card, logo, scatter symbol, text, press |
| `fs4` | 4-scatter FS intro | same shape as `fs3`, different art |
| `outro` | after the FS round | FS background, TOTAL WIN logo (`tw:640`), press |

The generator consumes `introLayers.json` verbatim (prefixing `import.meta.env.BASE_URL` to each `file`), one array per set: `{ file, role, cx, cy, tw? }`. See `src/data/introLayers.json` for the exact 18 `game` layers, 6 `fs3`, 6 `fs4`, 3 `outro`.

---

## 11. How to add your own art (per asset class)

| Asset class | Author as | Key rule |
|---|---|---|
| **Static symbol** | 512×512 RGBA, single centred icon, transparent bg, no caption | Named `symbol_<key>_landing.png`, keyed to SymbolId. Renders as a centred square ~72%·objectScale of the cell (103 px at default `large`). |
| **Symbol win sheet** | row-major grid, equal frames | Give exact `cols/rows/count/fps`; pad the sheet to a full rectangle, keep real frames first, motion looping and returning to frame 0. |
| **Symbol idle sheet** | same as win sheet | Must be a **seamless** loop (replaces the resting art). |
| **Expanding-wild tower** | tall RGBA, aspect ≥ 4.93 (5×5) / ≥ 2.96 (5×3) | Width-fit + top-anchored; **front-load content at the top** (base crops, more so on 5×3). Centre horizontally. |
| **Frame** | square RGBA with a transparent centre window > 20% of the image | Decorations in the border may spill left/right of the window; pass the window rect or rely on alpha auto-detect. |
| **Frame win flash** | row-major sheet | `region` is placement **inside the frame texture's px space**, not inside the sheet. |
| **Animated background** | 3 sheets, 4×4, seamless | Static poster + cross-faded loop; keep total dims divisible by cols/rows for integer frames. |
| **Win-tier marquee** | 1920×1080 PNG layers | Theme-neutral, shared across games; drop into `public/theme/win-tiers/`. |
| **Coin rain** | chroma-keyed spritesheets | Keyed to alpha at load; tight key so gold bodies stay opaque. |
| **Intro layers** | element-centred WEBP/PNG | Position by centre `cx,cy` in 1920×1080; set `tw` for target width; pick the right `role` for the motion you want. |

---

## 12. 5×5 vs 5×3 differences

The **only** geometry that changes between the two grids is the number of visible rows, and therefore the reel-column height. Cell size, gaps, frame, symbol art, backgrounds, win sheets, marquee, intro layers, and slicing are **identical**.

| | 5×5 | 5×3 |
|---|---|---|
| visible rows | 5 | 3 |
| cells per reel | 5 | 3 |
| reel column height | **580 px** | **348 px** |
| grid height | 580 px | 348 px |
| grid width | 632 px | 632 px (same) |
| cell size | 120×110 | 120×110 (same) |
| expanding-wild tower | width-fit, ~22 px base crop | width-fit, ~254 px base crop (content must sit in the top ~58%) |
| everything else | identical | identical |

The active grid is set at runtime via `setActiveGrid(GRID_5x5)` / `setActiveGrid(GRID_5x3)`; the same art bundle renders both.

---

## 13. Generator-consumable manifest (JSON)

Drop-in asset block (mirrors `src/studio/buildPresets.ts`; paths relative to `public/`, prefix each with the deploy base URL). Slicing/placement follow the rules above.

```json
{
  "grid": { "id": "5x5", "reels": 5, "rows": 5, "cell": { "w": 120, "h": 110, "gapV": 6, "gapH": 8 },
            "reelColumnHeight": 580, "framePad": 28, "headerH": 52, "sceneMargin": 40 },
  "symbolSize": { "preset": "large", "objectScale": 1.3, "baseFill": 0.72, "scatterMul": 1.2 },
  "symbols": {
    "0": "theme/vice/symbol_wild_landing.png",
    "1": "theme/vice/symbol_scatter_landing.png",
    "2": "theme/vice/symbol_high_a_landing.png",
    "3": "theme/vice/symbol_high_b_landing.png",
    "4": "theme/vice/symbol_mid_c_landing.png",
    "5": "theme/vice/symbol_mid_d_landing.png",
    "6": "theme/vice/symbol_low_e_landing.png",
    "7": "theme/vice/symbol_low_f_landing.png",
    "8": "theme/vice/symbol_low_g_landing.png"
  },
  "title": "theme/vice/logo.webp",
  "background": "theme/vice/bg_motel.webp",
  "backgroundLoop": { "sheets": ["theme/vice/bg_motel_anim_1.webp","theme/vice/bg_motel_anim_2.webp","theme/vice/bg_motel_anim_3.webp"], "cols": 4, "rows": 4, "count": 45, "fps": 6 },
  "fsBackground": "theme/vice/fsbg_beachclub.webp",
  "fsBackgroundLoop": { "sheets": ["theme/vice/fsbg_beachclub_anim_1.webp","theme/vice/fsbg_beachclub_anim_2.webp","theme/vice/fsbg_beachclub_anim_3.webp"], "cols": 4, "rows": 4, "count": 48, "fps": 6 },
  "frame": { "file": "theme/vice/frame_neon.webp", "window": { "x": 197, "y": 314, "w": 832, "h": 832 } },
  "frameWinFlash": { "file": "theme/vice/frame_win_flash_1.webp", "cols": 8, "rows": 6, "count": 48, "fps": 12, "region": { "x": 1025, "y": 225, "w": 475, "h": 1062.5 } },
  "expandingWild": "theme/vice/wild_column.webp",
  "winSheets": {
    "1": { "file": "theme/vice/scatterwin.webp", "cols": 8, "rows": 9, "count": 67, "fps": 15 },
    "2": { "file": "theme/vice/prem_a_win.webp", "cols": 7, "rows": 7, "count": 48, "fps": 12 },
    "3": { "file": "theme/vice/prem_b_win.webp", "cols": 7, "rows": 7, "count": 48, "fps": 12 },
    "4": { "file": "theme/vice/car_win.webp",   "cols": 7, "rows": 7, "count": 48, "fps": 12 },
    "5": { "file": "theme/vice/koffer_win.webp","cols": 7, "rows": 7, "count": 48, "fps": 12 }
  },
  "idleSheets": { "1": { "file": "theme/vice/scatteridle.webp", "cols": 10, "rows": 9, "count": 90, "fps": 10 } },
  "staticLookSymbols": [1],
  "noIdleSymbols": [0],
  "winTiers": { "dir": "theme/win-tiers/", "layers": ["big","mega","epic","max","win","plate"] },
  "coinRain": { "sheets": ["theme/win-tiers/coinrain3_0.webp","theme/win-tiers/coinrain3_1.webp","theme/win-tiers/coinrain3_2.webp"], "cols": 10, "rows": 10, "count": 300, "fps": 45 },
  "introLayers": "see src/data/introLayers.json (sets: game, fs3, fs4, outro; each layer { file, role, cx, cy, tw? } in 1920x1080 design space)"
}
```

For a **5×3** build, change only `grid.id`/`grid.rows`/`grid.reelColumnHeight` to `5x3` / `3` / `348`; every asset reference is unchanged.
