# Frame — flat band around the reel grid (drop-in)

The frame is now a **single flat colour band** that extends **outward from the
reel-grid edge** (Hacksaw-base look): inner edge = the reel window, outer edge
= `frameWidth` px further out, hole-punched over the window, with hairline
outer/inner edge rings for definition. No bevels, no sheen, no hardware.

**Universal neutral grey by default** (`#424242`, 22 px, solid) — colour,
thickness and opacity are live sliders. Purely visual; no odds/paytable/RTP
touched.

## Files

| File | What it is | How to use |
|------|-----------|------------|
| `color.ts` | Dependency-free HSL ⇄ hex helpers | Drop in as-is (same file as the other handoffs) |
| `frameBand.ts` | `FrameBand` controller + the exact `draw()` (band + hairlines, Graphics.cut) | Drop in as-is |
| `frameParams.ts` | The 6 whitelist entries | Spread into your `ADJUSTABLE_PARAMS` |
| `frameIntegration.ts` | Build + param wiring notes | Copy the two touch-points |

## Integration — 3 points

1. **Whitelist** — spread `FRAME_PARAMS`. `frameColor` is the `color` type
   (same single `<input type="color">` renderer case as the reel-background /
   cell-backdrop handoffs; the picker ⇄ H/S/L two-way sync is the identical
   pattern — `frameBand.hex` gives you the picker value).
2. **Build once** — one `Graphics` in the game container; on any change call
   `frameBand.draw(g, WIN_X, WIN_Y, WIN_W, WIN_H)` with the reel-window rect.
3. **Route params** — in `applyVisualParam`, `if (frameBand.set(id, value)) { redrawFrame(); return; }`.

⚠️ **Theme independence:** if your theme/skin pass repaints the frame, replace
that repaint with a plain `redrawFrame()` call. The band must never be
overdrawn from theme colours — in our build the old themed border kept
reappearing ON TOP of the new band until we did exactly this.

## What we REMOVED (and why) — please mirror this

The clean band only reads right once the old cabinet decorations around the
grid are gone. We deleted all of the following from the preview build; remove
their equivalents in yours or they will draw over/around the band again:

| Removed | What it was | Why it had to go |
|---------|-------------|------------------|
| **Themed 3-layer border** | `frameFill` base + `borderOuter` + `borderInner` rings + top **sheen** highlight, redrawn from theme colours in `setTheme()` | The old bezel look itself — and its `setTheme()` repaint kept overdrawing the new band on startup/theme change |
| **Corner rivets** | 4 accent-coloured screw dots in the frame corners | Themed hardware; not universal |
| **Row indicator dots** | Small dots left + right of the grid, one per row | The "Punkte" beside the frame; leftover cabinet hardware |
| **Scene vignette** | A 90 px blurred black `stroke()` around the whole scene | Showed as a dark smear on light custom backgrounds |
| **Outer glow rings** | 3 stacked accent-tinted roundRects extending 4/8/12 px beyond the frame | Read as a light halo hugging the band's outer edge |

After these removals the band sits directly on the background — nothing else
is drawn around the grid.

## Settings

| Param | Type | Default | Effect |
|-------|------|---------|--------|
| `frameColor` | colour | `#424242` | Band colour (picker; syncs H/S/L) |
| `frameHue` / `frameSaturation` / `frameLightness` | number | 0 / 0 / 26 | Band colour via sliders |
| `frameOpacity` | number 0–100 | 100 | Band transparency |
| `frameWidth` | number 0–36 | 22 | How far the band extends outward (px); 0 = no frame |

## Notes
- Hairline edges are **filled rings** (fill + `cut()`), not `stroke()` —
  strokes flicker at non-integer scale.
- `Graphics.cut()` (Pixi v8) punches the reel window out of the band, so the
  window area is genuinely transparent (your reel backdrop shows through).
- The band may extend past your old frame bounds when `frameWidth` is large —
  it draws outside the rect fine; just keep HUD/title clear of the top edge.
