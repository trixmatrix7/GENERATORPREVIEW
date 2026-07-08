# Win line — ways-light comet (drop-in, 1:1)

The **white win line**: a thin light comet that shoots THROUGH each winning
ways-connection — the beam grows toward the next symbol at the front while it
dissolves at the back, so the light flows left→right and is gone by the end.
Between two reels, every symbol connection (bipartite = ways) gets its own beam.
Combos fire **one after another** ("line nach line").

This is the **exact runtime code** — `WaysLightComet.ts` is the real file, dropped
in unchanged. Purely visual/additive: it never touches game logic, odds, or RTP.

## Files

| File | What it is | How to use |
|------|-----------|------------|
| `WaysLightComet.ts` | The effect (config, presets, `playWaysLight`, `clearAllWaysLight`) | Drop in **1:1** — only imports pixi.js + gsap |
| `winLineParams.ts` | The 4 whitelist entries (all `enum`) | Spread into your `ADJUSTABLE_PARAMS` |
| `winLineIntegration.ts` | The exact fire logic, reduced to 2 engine hooks | Copy the functions; swap the 2 hooks |

## Integration — 3 steps

### 1. Whitelist
Spread `WIN_LINE_PARAMS` into your adjustable-params array. All four are plain
`enum` — no new control type needed.

### 2. Two engine hooks
`winLineIntegration.ts` needs exactly two things from your reel layer:

```ts
// pixel centre of a cell (reel col, row) in reel-container coords:
cellCentre(reel, row) => { x, y }
// a Container on TOP of your reels, for the beams:
waysLightContainer
```

Also set the cell size once at build (so the comet head scales with the grid):

```ts
import { waysLightConfig } from './WaysLightComet';
waysLightConfig.cellSize = yourCellWidthPx;
```

### 3. Apply the params + fire it
In your `applyVisualParam`, delegate to `applyWinLineParam` (sets the live
config). After a win reveal, fire the combos line-by-line; on a new spin /
clear, kill any in-flight comet:

```ts
applyVisualParam(id, value) {
  if (applyWinLineParam(id, value)) return;   // waysLight / colour / speed / width
  // ...your other params...
}

// after the win is revealed (WinCombination[] = your evaluator's output):
void fireWaysLightSequential(winResult.combinations);

// in clearHighlights() / on spin:
clearAllWaysLight();
```

## Settings

| Param | Options | Default | Effect |
|-------|---------|---------|--------|
| `waysLight` | on / off | **on** | Feature toggle |
| `waysLightColor` | white / ice / gold / purple / green / pink | **white** | Beam colour |
| `waysLightSpeed` | slow / normal / fast | **normal** | 210 / 130 / 80 ms per reel-step |
| `waysLightWidth` | thin / medium / bold | **medium** | 1.6 / 2.4 / 3.6 px core |

## Notes
- Self-cleaning: each comet kills its own tweens + layer on finish; a new spin
  calls `clearAllWaysLight()` to cancel anything mid-flight.
- Additive blend (`blendMode: 'add'`), so it reads as light over the board.
- The comet head is capped at `min(cellSize * 0.26, 26)px` so it stays a tight
  glint, never a big blob.
- The connection it draws is your real ways data — feed it `WinCombination.cells`
  ([row, reel]); the grouping-by-reel + bipartite edges reproduce the ways look.
