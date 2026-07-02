// Anchor-point coordinate system.
//
// V1 animations hardcoded pixel coordinates inline (e.g., `i * (SYMBOL_WIDTH +
// REEL_GAP)`). V2 needs animations to declare *what* they target (a cell, a
// reel column, the whole grid, a whole row) and let the engine resolve to
// pixels for the active grid. This file is the resolver.
//
// The Anchor union exposes five variants:
//
//   V1-equivalent shapes (resolve to a Rect):
//     - cell(reel, row)         → single symbol cell
//     - reel(reel)              → full reel column
//     - grid                    → entire visible grid
//     - row(row)                → full horizontal strip across all reels
//
//   Forward-compat shape (declared, V3-deferred — throws on resolve):
//     - path(from, to)          → diagonal payline trace
//
// The resolver returns a { x, y, w, h } rect. Consumers add scene offsets
// (PixiApp grid container x/y) themselves — anchors are *grid-local* so
// they stay portable across canvas layouts.

import {
  buildLayout,
  DEFAULT_CELL_METRICS,
  getActiveGrid,
  type CellMetrics,
  type GridConfig,
  type Rect,
} from '@/config/gridConfig';

/** Cell coordinate referenced by `path` anchors. */
export interface CellCoord {
  readonly reel: number;
  readonly row: number;
}

export type Anchor =
  | { readonly kind: 'cell'; readonly reel: number; readonly row: number }
  | { readonly kind: 'reel'; readonly reel: number }
  | { readonly kind: 'row'; readonly row: number }
  | { readonly kind: 'grid' }
  | { readonly kind: 'path'; readonly from: CellCoord; readonly to: CellCoord };

/** Resolve an anchor to a grid-local pixel rect.
 *  Defaults to the active grid + default cell metrics; pass a grid/metrics
 *  override for non-active resolution (e.g., previewing a 5×5 game while
 *  a 5×3 game is active).
 *
 *  Throws when handed a `path` anchor — payline-trace resolution lands with
 *  the payline mechanic (V2 Stage 3). Declared here so the type union is
 *  stable across the V2 stages; runtime support arrives with payline. */
export function resolveAnchor(
  anchor: Anchor,
  grid: GridConfig = getActiveGrid(),
  metrics: CellMetrics = DEFAULT_CELL_METRICS,
): Rect {
  const layout = buildLayout(grid, metrics);

  switch (anchor.kind) {
    case 'cell':
      return layout.cellRect(anchor.reel, anchor.row);
    case 'reel':
      return layout.reelRect(anchor.reel);
    case 'row': {
      // Full horizontal strip at the given row index. Y matches a cell's Y at
      // that row (`row * cellHeight`); height is a single symbol's height
      // (not cellHeight — we don't include the trailing gap inside the strip,
      // so back-to-back row anchors don't visually overlap).
      const firstCell = layout.cellRect(0, anchor.row);
      return {
        x: 0,
        y: firstCell.y,
        w: layout.width,
        h: firstCell.h,
      };
    }
    case 'grid':
      return layout.gridRect();
    case 'path':
      throw new Error(
        `[anchors] 'path' anchors are V3 (payline-trace) work — not implemented in V2. ` +
        `Received path from (reel=${anchor.from.reel}, row=${anchor.from.row}) ` +
        `to (reel=${anchor.to.reel}, row=${anchor.to.row}).`,
      );
  }
}

// ── Convenience constructors ───────────────────────────────────────────────
//
// Registries declare anchors as data; the constructors make call-sites
// readable without importing the discriminated-union literal each time.

export const cell = (reel: number, row: number): Anchor => ({ kind: 'cell', reel, row });
export const reel = (r: number): Anchor => ({ kind: 'reel', reel: r });
export const row = (r: number): Anchor => ({ kind: 'row', row: r });
export const grid: Anchor = { kind: 'grid' };
export const path = (from: CellCoord, to: CellCoord): Anchor => ({ kind: 'path', from, to });
