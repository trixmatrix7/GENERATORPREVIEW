# Cell backdrop — per-symbol pocket (drop-in)

A rounded **pocket behind each symbol** — colour, opacity, corner radius, inset
(gap) and an optional border, all on live sliders. **Static + universal**, and
crucially it lives **on each symbol**, so it spins during the spin, lands with
the symbol, and sits permanently around it (NOT a fixed grid the symbols fly
into). Purely visual — no odds/paytable/RTP touched.

Defaults = a subtle dark rounded pocket, so you see it working immediately.

## Files

| File | What it is | How to use |
|------|-----------|------------|
| `color.ts` | Dependency-free HSL ⇄ hex helpers | Drop in as-is |
| `cellBackdrop.ts` | `cellBackdropConfig` singleton + `drawCellPocket(g,w,h)` | Drop in as-is |
| `cellBackdropParams.ts` | The 9 whitelist entries | Spread into your `ADJUSTABLE_PARAMS` |
| `cellBackdropIntegration.ts` | `setCellBackdropParam(id,value)` + wiring notes | Copy the function; add 2 hooks |

## Integration — 3 points

### 1. Whitelist
Spread `CELL_BACKDROP_PARAMS` into your adjustable-params array. Two of them are
the `color` type — reuse the same `<input type="color">` renderer case + the
two-way colour⇄H/S/L sync from the **reel-background** handoff (identical
pattern; just for `cellBg*`).

### 2. Draw it on each symbol tile (this is the behaviour)
In the method that fills a symbol's background graphic, call `drawCellPocket`
**first**, before the symbol art:

```ts
import { drawCellPocket } from './cellBackdrop';

private drawTile() {
  const g = this.bg;              // the symbol's own background Graphics
  g.clear();
  drawCellPocket(g, CELL_W, CELL_H);   // ← behind the art; travels with the symbol
  // ...draw the symbol icon/PNG on top...
}
```

Because `bg` is a child of the symbol, the pocket **scrolls + lands with the
symbol automatically** — no per-frame work.

### 3. Apply params + redraw
In `applyVisualParam`, update the config and redraw every symbol tile:

```ts
if (setCellBackdropParam(id, value)) {
  this.reelSet.refreshAllTiles();   // your "redraw every symbol tile"
  return;
}
```

## Settings

| Param | Type | Default | Effect |
|-------|------|---------|--------|
| `cellBgColor` | colour | `#101018` | Fill colour (picker; syncs H/S/L) |
| `cellBgHue` / `cellBgSaturation` / `cellBgLightness` | number | 240 / 20 / 8 | Fill colour via sliders |
| `cellBgOpacity` | number 0–100 | 45 | Pocket transparency |
| `cellBgRadius` | number 0–40 | 14 | Corner rounding (px) |
| `cellBgInset` | number 0–30 | 3 | Inset from cell edge = gap between pockets (px) |
| `cellBgBorderColor` | colour | `#ffffff` | Outline colour |
| `cellBgBorderWidth` | number 0–8 | 0 | Outline thickness (0 = none) |

## Notes
- The pocket is the base layer of each symbol tile; the symbol art draws on top.
- For symbols rendered from an animation atlas (sprite mode) rather than a static
  tile, draw the pocket on that symbol's background too if you want it there.
- Purely presentational; the maths are untouched.
