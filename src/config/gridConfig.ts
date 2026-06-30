// gridConfig.ts — cell metrics + grid presets.
// Constants match the dev generator's src/config/gridConfig.ts:
//   symbolWidth=120, symbolHeight=110, symbolGap=3, reelGap=4.
// One entry must work on both 5x3 and 5x5 — so renderers use ANCHORS
// (engine/anchors.ts), never raw pixels. These metrics only size the stage.

export const SYMBOL_WIDTH = 120;
export const SYMBOL_HEIGHT = 110;
export const SYMBOL_GAP = 3; // vertical gap between cells in a reel
export const REEL_GAP = 4; // horizontal gap between reels

export type GridId = '5x5' | '5x3';

export interface GridSpec {
  id: GridId;
  cols: number;
  rows: number;
  ways: number; // cols^rows (full-strip ways)
}

export const GRIDS: Record<GridId, GridSpec> = {
  '5x5': { id: '5x5', cols: 5, rows: 5, ways: 5 ** 5 }, // 3125 — the Fantasy spec
  '5x3': { id: '5x3', cols: 5, rows: 3, ways: 5 ** 3 }, // 243 — layout/animation test mode
};

export const DEFAULT_GRID: GridId = '5x5';

export interface GridLayout {
  spec: GridSpec;
  cellW: number;
  cellH: number;
  /** total reel-area width/height (no outer padding). */
  width: number;
  height: number;
  /** x of reel r (left edge of the reel column). */
  reelX: (reel: number) => number;
  /** y of row (top edge of cell). */
  rowY: (row: number) => number;
  /** center of a cell. */
  cellCenter: (reel: number, row: number) => { x: number; y: number };
}

export function computeLayout(grid: GridSpec): GridLayout {
  const cellW = SYMBOL_WIDTH;
  const cellH = SYMBOL_HEIGHT;
  const width = grid.cols * cellW + (grid.cols - 1) * REEL_GAP;
  const height = grid.rows * cellH + (grid.rows - 1) * SYMBOL_GAP;

  const reelX = (reel: number) => reel * (cellW + REEL_GAP);
  const rowY = (row: number) => row * (cellH + SYMBOL_GAP);
  const cellCenter = (reel: number, row: number) => ({
    x: reelX(reel) + cellW / 2,
    y: rowY(row) + cellH / 2,
  });

  return { spec: grid, cellW, cellH, width, height, reelX, rowY, cellCenter };
}
