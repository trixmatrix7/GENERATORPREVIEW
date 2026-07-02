// Runtime grid configuration.
//
// V1 hardwired the grid to 5×3 via the REEL_COUNT / VISIBLE_ROWS constants in
// src/config/reels.ts. V2 needs grid dimensions as a *runtime* value so the
// same engine can render 5×3 (low-vol) or 5×5 (high-vol) without code forks.
//
// This module is purely additive — callers continue to read from reels.ts
// until the engine-side refactor routes them through `getActiveGrid()` instead.
// Default is GRID_5x3 so the V1 path stays byte-for-byte unchanged while the
// wiring is in flight.

/** Cell-size metrics used by the renderer. Mirrors V1 constants exactly so
 *  the existing 5×3 layout reproduces pixel-identically once callers route
 *  through this module. */
export interface CellMetrics {
  /** Width of a single symbol cell in CSS pixels. */
  readonly symbolWidth: number;
  /** Height of a single symbol cell in CSS pixels. */
  readonly symbolHeight: number;
  /** Vertical gap between cells within a reel column. */
  readonly symbolGap: number;
  /** Horizontal gap between reels. */
  readonly reelGap: number;
}

/** V1 cell metrics — source of truth for the 5×3 layout. 5×5 uses the same
 *  metrics; the canvas grows to fit the extra rows. */
export const DEFAULT_CELL_METRICS: CellMetrics = {
  symbolWidth: 120,
  symbolHeight: 110,
  symbolGap: 6,
  reelGap: 8,
} as const;

/** V2 ships ways-pays only */
export type PayModel = 'ways';

export interface GridConfig {
  /** Number of reels (columns). 5 for both V2 grids. */
  readonly reelCount: number;
  /** Visible rows per reel column. 3 for 5×3, 5 for 5×5. */
  readonly visibleRows: number;
  /** Length of each reel strip — kept aligned with the math manifests
   *  (V1 + initial V2 manifests use 40). The engine doesn't depend on this
   *  for layout; included so consumers have one canonical place to read it. */
  readonly stripLength: number;
  /** Pay model. V2 = ways-only. */
  readonly payModel: PayModel;
  /** Stable string id used for manifest keys + registry compatibility checks. */
  readonly id: '5x3' | '5x5';
}

export const GRID_5x3: GridConfig = {
  reelCount: 5,
  visibleRows: 3,
  stripLength: 40,
  payModel: 'ways',
  id: '5x3',
} as const;

export const GRID_5x5: GridConfig = {
  reelCount: 5,
  visibleRows: 5,
  stripLength: 40,
  payModel: 'ways',
  id: '5x5',
} as const;

/** All shipped V2 grids, in canonical order. Useful for compatibility-matrix
 *  declarations on registry entries. */
export const ALL_GRIDS: ReadonlyArray<GridConfig> = [GRID_5x3, GRID_5x5];

// ── Active-grid singleton ──────────────────────────────────────────────────
//
// One process can render only one game at a time today (the wizard preview
// or the production game iframe), so a module-level singleton is the right
// shape. When/if we render multiple games concurrently (V3), this becomes
// a per-PixiApp instance value passed through React context — see the V2
// roadmap §07_runtime_architecture.

let activeGrid: GridConfig = GRID_5x3;

/** Read the active grid. Defaults to GRID_5x3 (V1 parity). */
export function getActiveGrid(): GridConfig {
  return activeGrid;
}

/** Set the active grid. Called by PixiApp / generator pipeline at game start.
 *  Idempotent; safe to call with the same grid. */
export function setActiveGrid(grid: GridConfig): void {
  activeGrid = grid;
}

/** Reset to V1 default. Test-only helper — production code paths set the
 *  grid explicitly via setActiveGrid(). */
export function resetActiveGridForTests(): void {
  activeGrid = GRID_5x3;
}

// ── Derived layout (computed, not stored) ──────────────────────────────────

export interface GridLayout {
  /** Total grid width in pixels. */
  readonly width: number;
  /** Total grid height in pixels. */
  readonly height: number;
  /** Pixel rect of a single cell at (reel, row), origin top-left of grid. */
  cellRect(reel: number, row: number): Rect;
  /** Pixel rect of an entire reel column. */
  reelRect(reel: number): Rect;
  /** Pixel rect of the whole grid (origin {0,0}, full size). */
  gridRect(): Rect;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Build a GridLayout from a GridConfig + cell metrics.
 *  Defaults to DEFAULT_CELL_METRICS — pass a different CellMetrics when the
 *  consumer (e.g., mobile breakpoint) needs scaled cells.
 *
 *  Geometry conventions are intentionally asymmetric to match V1's existing
 *  pixel math byte-for-byte:
 *    - Horizontal: gaps live BETWEEN reels →
 *        width = reelCount × symbolWidth + (reelCount − 1) × reelGap
 *    - Vertical:   each row OWNS its bottom gap →
 *        height = visibleRows × (symbolHeight + symbolGap)
 *  This mirrors `ReelSet.totalHeight = visibleRows * CELL_HEIGHT` and
 *  `ReelSet.totalWidth = reelCount * SYMBOL_WIDTH + (reelCount - 1) * REEL_GAP`
 *  in src/game/ReelSet.ts. Future cleanup may normalise both axes — until
 *  then, parity with V1 wins. */
export function buildLayout(
  grid: GridConfig = activeGrid,
  metrics: CellMetrics = DEFAULT_CELL_METRICS,
): GridLayout {
  const { reelCount, visibleRows } = grid;
  const { symbolWidth, symbolHeight, symbolGap, reelGap } = metrics;

  const width = reelCount * symbolWidth + (reelCount - 1) * reelGap;
  // Each row owns its bottom gap — matches V1's CELL_HEIGHT convention.
  const cellHeight = symbolHeight + symbolGap;
  const height = visibleRows * cellHeight;

  return {
    width,
    height,
    cellRect(reel, row) {
      return {
        x: reel * (symbolWidth + reelGap),
        y: row * cellHeight,
        w: symbolWidth,
        h: symbolHeight,
      };
    },
    reelRect(reel) {
      return {
        x: reel * (symbolWidth + reelGap),
        y: 0,
        w: symbolWidth,
        h: height,
      };
    },
    gridRect() {
      return { x: 0, y: 0, w: width, h: height };
    },
  };
}
